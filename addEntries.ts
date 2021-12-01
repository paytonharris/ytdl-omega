import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import ShortUniqueId from 'short-unique-id';
import { addVideoEntryToDB, getVideoCodesFromDB, updateVideoEntryInDB, addVideoEntriesToDB, VideoDBRow, VideoDBEntry } from './db';

const input = [
  'll4J0QVHqhk',
  'N3Ay4OtrVOg',
  '8AEORQo_Qjo',
  '3O1oEFziRmo',
  'flD1H1yhIxo',
  'bmNwmbNXMR4',
  'LpOm96Zjrx0',
  'JZZNQYFNgtk',
  'nt-u8RN4ElA',
  'gnPnSXJXmwA',
  'b-X8KGEJ8VA',
  'SJ6GmIf3ZAs',
  'XyGwIfGgBNQ',
  'qQGzLEjIEnA'
]

const input2 = [
  'tMJYseGTFjY'
]

try {
  var entries: VideoDBEntry[] = []

  for (const code of input) {
    entries.push({
        videoCode: code,
        dateQueued: new Date(),
        priority: 100,
    })
  }

  addVideoEntriesToDB(entries);

} catch (error) {
  console.error(error)
}