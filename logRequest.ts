import { MongoClient } from 'mongodb';
import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { dbName, url } from './db';

const collectionName = 'requests';

interface LocationData {
  ip?: string;
  country_code?: string;
  country_name?: string;
  region_code?: string;
  region_name?: string;
  city?: string;
  zip_code?: string;
  time_zone?: string;
  latitude?: number;
  longitude?: number;
  metro_code?: number;
}

export const logRequest = async (req: any, res: any) => {
  try {
    let userData: any = {}
    userData.host = req.headers?.host
    userData.url = req.url
    userData.method = req.method
    userData.userAgent = req.headers && req.headers['user-agent']
    userData.ipAddress = {}
  
    if (req.connection?.socket?.remoteAddress) {
      userData.ipAddress.ip = userData.ipAddress.socketRemoteAddress = req.connection.socket.remoteAddress
    }
    if (req.socket?.remoteAddress) {
      userData.ipAddress.ip = userData.ipAddress.remoteAddress = req.socket.remoteAddress
    }
    if (req.connection?.remoteAddress) {
      userData.ipAddress.ip = userData.ipAddress.remoteAddress = req.connection.remoteAddress
    }
    if (req.headers['x-forwarded-for']) {
      userData.ipAddress.ip = userData.ipAddress['x-forwarded-for'] = req.headers['x-forwarded-for']
    }

    let location: LocationData = {};

    if (userData.ipAddress?.ip) {
      location = await getLocationOfIP(userData.ipAddress?.ip) as LocationData
    }

    userData.location = location;

    console.log(`New Request from ${location.city}, ${location.country_name}`)
    console.log(`\t${JSON.stringify(req.body)}`)
    console.log(`\t${JSON.stringify(userData)}`)
    console.log(`\t${JSON.stringify(location)}\n`)

    await addRequestEntryToDB({ requestInfo: userData, body: req.body, date: (new Date()) })

  } catch (error) {
    console.error(error)
  }
}

export var addRequestEntryToDB = (entry: any) => {
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

const getLocationOfIP = (ip: string) => {
  return new Promise(async (resolve, reject) => {
    let workingData = '';

    try {
      const process = spawn('curl', [`https://freegeoip.app/json/${ip}`]);
  
      process.stdout.on('data', (data) => {
        workingData = `${workingData}${data}`
      });
  
      process.stderr.on('data', (data) => {
        console.error(data);
      });
  
      process.on('exit', (code, signal) => {
        let response = {};
        
        try {
          response = JSON.parse(workingData)
        } catch (error) {
          console.error(error);
          response = { error: `could not parse the json response for ip lookup. workingData was: \n\n${workingData}` }
        }
        resolve(response)
      });

    } catch (error) {
      reject({});
    }
  });
}