import { MongoClient } from 'mongodb';

export const url = "mongodb://127.0.0.1:27017/"
export const dbName = 'omega';
const collectionName = 'yt';

export interface VideoDBEntry {
  videoCode: string;
  dateQueued: Date;
  failedDownload?: boolean;
  completedDownload?: boolean;
  dateCompleted?: Date;
  messageLogs?: string;
  errorMessageLogs?: string;
  priority: number;
}

export interface VideoDBRow {
  videoCode: string;
  dateQueued: Date;
  failedDownload?: boolean;
  completedDownload?: boolean;
  dateCompleted?: Date;
  messageLogs?: string;
  errorMessageLogs?: string;
  priority: number;
  _id: any;
}

export interface VideoDBUpdate {
  failedDownload?: boolean;
  completedDownload?: boolean;
  dateCompleted?: Date;
  messageLogs?: string;
  errorMessageLogs?: string;
}

export var getVideoCodesFromDB = (desiredCount: number) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();

      const db = client.db(dbName);
      const items = db
        .collection(collectionName)
        .find({ completedDownload: { $ne: true }, failedDownload: { $ne: true }, isDownloading: { $ne: true }, isRetrying: { $ne: true } })
        .limit(desiredCount)
        .sort({ priority: 1, dateQueued: 1})

      resolve(await items.toArray());

    } catch (error) {
      reject(error);
    } finally {
      client.close();
    }
  });
}

export var getVideoIncompleteCodesFromDB = (desiredCount: number) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();

      const db = client.db(dbName);
      const items = db
        .collection(collectionName)
        .find({ completedDownload: { $ne: true }, isRetrying: { $ne: true }, isDownloading: true })
        .limit(desiredCount)
        .sort({ priority: 1, dateQueued: 1})

      resolve(await items.toArray());

    } catch (error) {
      reject(error);
    } finally {
      client.close();
    }
  });
}

export var addVideoEntryToDB = (entry: VideoDBEntry) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();
      const db = client.db(dbName);
      db.collection(collectionName).insertOne(entry).then(() => {
        client.close();
      })

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

export var addVideoEntriesToDB = (entries: VideoDBEntry[]) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();
      const db = client.db(dbName);
      db.collection(collectionName).insertMany(entries).then(() => {
        client.close();
      })

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

export var updateVideoEntryInDB = (entry: VideoDBUpdate, id: any) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();
      const db = client.db(dbName);
      db.collection(collectionName).updateOne({ _id: id}, { $set: {
        errorMessageLogs: entry.errorMessageLogs,
        messageLogs: entry.messageLogs,
        dateCompleted: entry.dateCompleted,
        completedDownload: entry.completedDownload,
        failedDownload: entry.failedDownload,
      }}).then(() => {
        client.close();
      })

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

export const markItemsAsBeingDownloadedInDB = (entries: VideoDBRow[]) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();
      const db = client.db(dbName);

      entries.forEach((entry, index) => {
        db.collection(collectionName).updateOne({ _id: entry._id}, { $set: {
          isDownloading: true
        }}).then(() => {
          if (index+1 === entries.length) {
            client.close();
          }
        })
      })

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

export const markItemsAsBeingRetriedInDB = (entries: VideoDBRow[]) => {
  return new Promise(async (resolve, reject) => {
    const client = new MongoClient(url);
    try {
      await client.connect();
      const db = client.db(dbName);

      entries.forEach((entry, index) => {
        db.collection(collectionName).updateOne({ _id: entry._id}, { $set: {
          isRetrying: true
        }}).then(() => {
          if (index+1 === entries.length) {
            client.close();
          }
        })
      })

      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}