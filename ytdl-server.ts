import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ShortUniqueId from 'short-unique-id';
import fs from 'fs';

// test errors with this url: https://www.youtube.com/watch\?v\=O-MViv-D0ow
// ERROR: Did not get any data blocks
// to fix: use: youtube-dl -f "bestvideo[ext=mp4]" https://www.youtube.com/watch\?v\=O-MViv-D0ow

// other common error (403):
// ERROR: unable to download video data: HTTP Error 403: Forbidden

const uid = new ShortUniqueId({ length: 12 })
const desiredSimultaneousDownloads = 3;

interface Process {
  id: string;
  proc: ChildProcessWithoutNullStreams;
  hasRetriedAfterA403: boolean;
  hasRetriedAfterACodeBlocksError: boolean;
  messages: string[];
  errorMessages: string[];
  recentMessage: string;
  videoCode: string;
}

let processes: Process[] = []

const getCodes = (desiredCount: number) => {
  // do some mongodb query
  // return desiredCount codes

  let codes: string[] = []

  return codes;
}

const startDownload = (
  code: string,
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
    })
    // console.log('created process id ' + processUID)

    process.stdout.on('data', (data) => {
      let myProcess = processes.filter((process) => process.id === processUID)

      // console.log("process:")
      // console.log(JSON.stringify(myProcess, null, 2))

      if (myProcess.length === 1) {
        myProcess[0].messages.push(data.toString())
        myProcess[0].recentMessage = data;
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
                !myProcess[0].hasRetriedAfterA403,
                !myProcess[0].hasRetriedAfterACodeBlocksError,
                [],
                myProcess[0].messages,
                myProcess[0].errorMessages
              )
            }, 5000);
          } else {
            // tried twice and got 403 both times. 
            // TODO: mark this download as failed in the database.
          }

        } else if (data.toString().includes('Did not get any data blocks')) {
          if (!myProcess[0].hasRetriedAfterACodeBlocksError) {

            console.error("retrying because of code blocks")

            setTimeout(() => {
              startDownload(
                myProcess[0].videoCode,
                !myProcess[0].hasRetriedAfterA403,
                !myProcess[0].hasRetriedAfterACodeBlocksError,
                ["-f", "bestvideo[ext=mp4]"],
                myProcess[0].messages,
                myProcess[0].errorMessages
              )
            }, 5000);
          } else {

            // TODO: mark this download as failed in the database.
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
        // console.log("completed a processes and successfully removed it from processes array.");

        // TODO: mark it successfully downloaded in the DB.
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
    `logs-${proc.videoCode}-${proc.id}.txt`,
    `${JSON.stringify(proc.messages, null, 2)}\n\nerrors: ${JSON.stringify(proc.errorMessages, null, 2)}`,
    err => {
      if (err) return console.log(err);
    }
  );
}

const printStatus = () => {
  // console.log(JSON.stringify(processes, null, 2))

  console.clear()

  console.log('---- ytdl OMEGA ----')

  if (processes.length === 0) {
    console.log("No processes -- currently idle");
  } else {
    console.log(`${processes.length} current downloads`);
  }

  for (const proc of processes) {

    const info403 = proc.hasRetriedAfterA403 ? ' (second attempt after 403)' : ''
    const infoCodeBlocks = proc.hasRetriedAfterACodeBlocksError ? ' (second attempt after code blocks error)' : ''

    process.stdout.write(`${proc.recentMessage}${info403}${infoCodeBlocks}\n`);
  }
}

const refresh = () => {
  if (processes.length < desiredSimultaneousDownloads) {
    getCodes(desiredSimultaneousDownloads - processes.length);

    // query db for more youtube videos and start the processes
  }
}

setInterval(() => {
  refresh()
  printStatus()
}, 500)

startDownload('QpQY8uXW3JY')
startDownload('3O1oEFziRmo')
startDownload('O-MViv-D0ow')