import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ShortUniqueId from 'short-unique-id';
import { addVideoEntryToDB, getVideoCodesFromDB, updateVideoEntryInDB, addVideoEntriesToDB, VideoDBRow, VideoDBEntry } from './db';

interface WorkingCodes {
  [codeOfPlaylist: string]: string[] // this weird signature [thing: string] is a way to use an object where the keys can be any string, but the value is always the same type.
}

var codes: WorkingCodes = {}

const addCodesToDB = (codes: string[], priority: number) => {
  if (codes.length < 1) { // validate input a little
    console.error("no codes were given when attempting to add them to database");
    return;
  }

  try {
    var entries: VideoDBEntry[] = []
  
    for (const code of codes) {
      entries.push({
          videoCode: code,
          dateQueued: new Date(),
          priority,
      })
    }
  
    addVideoEntriesToDB(entries);

    console.log('Adding to queue:')
    console.log(JSON.stringify(entries, null, 2))
  
  } catch (error) {
    console.error(error)
  }
}

const getCodesFromPlaylist = (playlistCode: string, priority: number) => {

  codes[playlistCode] = [];

  const process = spawn('youtube-dl', ['--get-id', `${playlistCode}`]);

  process.stdout.on('data', (data) => {
    codes[playlistCode].push(data.toString().trim())
  });

  process.stderr.on('data', (data) => {
    console.error(data);
  });

  process.on('exit', (code, signal) => {
    addCodesToDB(codes[playlistCode], priority)
    delete codes[playlistCode]
  });

  process.on('close', (code: number, args: any[])=> {

  });
}

export const queueUpPlaylistOrVideoForDownload = (code: string, priority: number) => {
  getCodesFromPlaylist(code, priority);
}