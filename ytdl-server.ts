import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ShortUniqueId from 'short-unique-id';
import fs from 'fs';
import { addVideoEntryToDB,
  getVideoCodesFromDB,
  updateVideoEntryInDB,
  addVideoEntriesToDB,
  VideoDBRow,
  markItemsAsBeingDownloadedInDB,
  getVideoIncompleteCodesFromDB,
  markItemsAsBeingRetriedInDB,
} from './db';

const uid = new ShortUniqueId({ length: 12 })
const desiredSimultaneousDownloads = 25;
let shouldRetryFailedVideos = true; // When it's in this state, it queries the db for failed downloads instead of new videos
let getCodesIsRunning = false;
let processes: Process[] = []

interface Process {
  id: string;
  proc: ChildProcessWithoutNullStreams;
  hasRetriedAfterA403: boolean;
  hasRetriedAfterACodeBlocksError: boolean;
  messages: string[];
  errorMessages: string[];
  recentMessage: string;
  videoCode: string;
  dbID: string;
}

const getCodes = async (desiredCount: number) => {
  getCodesIsRunning = true;

  let codes: string[] = []

  try {
    var getVideos = shouldRetryFailedVideos ? getVideoIncompleteCodesFromDB : getVideoCodesFromDB
    var markDownloadAsInProgress = shouldRetryFailedVideos ? markItemsAsBeingRetriedInDB : markItemsAsBeingDownloadedInDB

    const videos = await getVideos(desiredCount) as VideoDBRow[]

    if (videos.length === 0) {
      shouldRetryFailedVideos = !shouldRetryFailedVideos; // if no new videos were found, next time try failed videos and vice versa.
      getCodesIsRunning = false;
      return;
    }

    await markDownloadAsInProgress(videos);

    videos.forEach((video, index) => {
      if (video._id && video.videoCode) {
        setTimeout(() => {
          startDownload(video.videoCode, video._id || "noid")

          // if this is the last video queued to download, wait 5 seconds and then tell the rest of the program that "getCodes" is no longer running.
          // when getCodes is running, new queries to the database for more videos to download would cause duplicates with those currently being started.
          if (index + 1 === videos.length) {
            setTimeout(() => {
              getCodesIsRunning = false;
            }, 5000)
          }
        }, 1000 * index)
      }
    })
  } catch (error) {
    console.error(error);
  }

  return codes;
}

const startDownload = (
  code: string,
  dbID: string,
  shouldRetryAfterA403: boolean = true,
  shouldRetryAfterACodeBlocksError: boolean = true,
  extraParams: string[] = [],
  currentMessages: string[] = [],
  currentErrorMessages: string[] = [],
  ) => {
  try {
    const process = spawn('youtube-dl', [`https://www.youtube.com/watch\?v\=${code}`, ...extraParams]);

    const processUID = uid();

    processes.push({
      id: processUID,
      proc: process,
      hasRetriedAfterA403: !shouldRetryAfterA403,
      hasRetriedAfterACodeBlocksError: !shouldRetryAfterACodeBlocksError,
      messages: currentMessages,
      errorMessages: currentErrorMessages,
      recentMessage: 'spawned',
      videoCode: code,
      dbID
    })

    process.stdout.on('data', (data) => {
      let myProcess = processes.filter((process) => process.id === processUID)

      if (myProcess.length === 1) {
        myProcess[0].recentMessage = data;

        const dataString = data.toString()
        if (!(dataString.includes('[download]') && dataString.includes(' at '))) { // filter out the constant download progress message.
          myProcess[0].messages.push(data.toString())
        }
      }
      else {
        console.error("got multiple processes with the same id")
      }
    });

    process.stderr.on('data', (data) => {
      let myProcess = processes.filter((process) => process.id === processUID)

      if (myProcess.length === 1) {
        myProcess[0].errorMessages.push(data.toString())
        myProcess[0].recentMessage = data;

        if (data.toString().includes('HTTP Error 403')) {

          if (!myProcess[0].hasRetriedAfterA403) {

            // if you get a 403, and it's the first time you've gotten it for this video, try again in 5 seconds
            // it's probably just youtube throttling your downloads.
            setTimeout(() => {
              startDownload(
                myProcess[0].videoCode,
                myProcess[0].dbID,
                !myProcess[0].hasRetriedAfterA403,
                !myProcess[0].hasRetriedAfterACodeBlocksError,
                [],
                myProcess[0].messages,
                myProcess[0].errorMessages
              )
            }, 5000);
          } else {
            // tried twice and got 403 both times. 
            // mark this download as failed in the database.
            try {
              updateVideoEntryInDB({
                dateCompleted: new Date(),
                errorMessageLogs: JSON.stringify(myProcess[0].errorMessages, null, 2),
                messageLogs: JSON.stringify(myProcess[0].messages, null, 2),
                failedDownload: true,
              }, myProcess[0].dbID)
            } catch (error) {
              console.error(error);
            }
          }

        } else if (data.toString().includes('Did not get any data blocks')) {
          if (!myProcess[0].hasRetriedAfterACodeBlocksError) {

            console.error("retrying because of code blocks")

            setTimeout(() => {
              startDownload(
                myProcess[0].videoCode,
                myProcess[0].dbID,
                !myProcess[0].hasRetriedAfterA403,
                !myProcess[0].hasRetriedAfterACodeBlocksError,
                ["-f", "bestvideo[ext=mp4]"],
                myProcess[0].messages,
                myProcess[0].errorMessages
              )
            }, 5000);
          } else {

            // mark this download as failed in the database.
            try {
              updateVideoEntryInDB({
                dateCompleted: new Date(),
                errorMessageLogs: JSON.stringify(myProcess[0].errorMessages, null, 2),
                messageLogs: JSON.stringify(myProcess[0].messages, null, 2),
                failedDownload: true,
              }, myProcess[0].dbID)
            } catch (error) {
              console.error(error);
            }
          }
        }
      }
      else {
        console.error("from stderr; got multiple processes with the same id")
      }
    });

    process.on('exit', (code, signal) => {
      let myProcess = processes.filter((process) => process.id === processUID)
      if (myProcess.length === 1) {
        saveLogs(myProcess[0]);
      }

      var numOfProcessesBefore = processes.length;
      processes = processes.filter((process) => process.id !== processUID)
      var numOfProcessesAfter = processes.length;

      if (numOfProcessesBefore - numOfProcessesAfter === 1) {

        // mark it successfully downloaded in the DB.
        try {
          updateVideoEntryInDB({
            dateCompleted: new Date(),
            errorMessageLogs: JSON.stringify(myProcess[0].errorMessages, null, 2),
            messageLogs: JSON.stringify(myProcess[0].messages, null, 2),
            completedDownload: true,
          }, myProcess[0].dbID)

          // queue up the next video to download:
          setTimeout(() => {
            refresh();
          }, 2000)
        } catch (error) {
          console.error(error);
        }
      }
      else {
        console.error("from exit; got multiple processes with the same id")
      }
    });

    process.on('close', (code: number, args: any[])=> {
      // console.log(`spawn on close code: ${code} args: ${args}`);
    });
  }
  catch (error) {
    console.error(error);
  }
}

const saveLogs = (proc: Process) => {
  fs.writeFile(
    `logs/${proc.videoCode}-${proc.id}.txt`,
    `${JSON.stringify(proc.messages, null, 2)}\n\nerrors: ${JSON.stringify(proc.errorMessages, null, 2)}`,
    err => {
      if (err) return console.log(err);
    }
  );
}

const printStatus = () => {
  console.clear()

  console.log('OMEGA')

  if (shouldRetryFailedVideos) {
    console.log("Retrying failed downloads")
  } else {
    console.log("Starting new downloads")
  }

  if (processes.length === 0) {
    console.log("No processes -- currently idle");
  } else {
    console.log(`${processes.length} current downloads`);
  }

  for (const proc of processes) {

    const info403 = proc.hasRetriedAfterA403 ? ' (second attempt after 403)' : ''
    const infoCodeBlocks = proc.hasRetriedAfterACodeBlocksError ? ' (second attempt after code blocks error)' : ''

    console.log(`(${proc.videoCode}) - ${proc.recentMessage.toString().trim()}${info403}${infoCodeBlocks}`);
  }
}

// this gets the videos codes and starts the downloads. It gets triggered when a download finishes and when the script first starts.
const refresh = () => {
  if (processes.length < desiredSimultaneousDownloads && !getCodesIsRunning) {
    getCodes(desiredSimultaneousDownloads - processes.length);
  }
}

// continually refresh terminal with status of downloads.
setInterval(() => {
  printStatus()
}, 1000)

// normally, refetching videos is triggered by a video finishing a download, 
// but if there are no more videos to download, it should keep checking the database every 30 seconds
// in case more videos get added later.
setInterval(() => {
  refresh();
}, 30000)

refresh(); // this is the entry point for the program. 