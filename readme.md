# YTDL-OMEGA

Simultaneously download any number of YouTube videos from playlists that you add to the queue. This node script will let you queue videos you want to download and then use youtube-dl to download many at once.

## How it works

It functions in two parts: 

1. The script `ytdl-server.ts` will spawn the download processes, and show you the progress.

2. The script `server.ts` is an API that queues videos in a mongoDB database. 

You POST a playlist code to the API, and it puts each of the videos from the playlist into the queue. Then, the `ytdl-server` script will check for queued video codes in the DB and start downloading them. 

## Dependencies

- mongodb
- youtube-dl
- node
- typescript
- ffmpeg (recommended so youtube-dl can download the highest quality version of each video)
- python

## How to start it

1. Run `npm i` to install dependencies (you'll still have to install the other dependencies above separately).
2. Run `tsc` to transpile the TypeScript to JavaScript.
3. Run `node server.js` to start the API.
4. Run `node ytdl-server.js` to start looking for downloads queued and start downloading.
5. POST a playlist code to the API like this:

  ```
  curl --location --request POST 'localhost:5312/api/queue' \
--header 'Content-Type: application/json' \
--data-raw '{
    "code": "UUgBVkKoOAr3ajSdFFLp13_A",
    "priority": 20
}'
  ```

  Or if you're not using curl, basically just POST to `localhost:5312/api/queue` a JSON object like:

  ```
{
    "code": "UUgBVkKoOAr3ajSdFFLp13_A",
    "priority": 20
}
  ```

`"code"` is required. It's the playlist code YouTube shows in the URL of a playlist. 

`"priority"` is optional, and defaults to `100`. A lower number means higher priority, so the next time the download script queries the database for the next videos to download, a video with priority `1` will skip the queue and be started before videos with priority `20` for example.

## Other info

Use a config file to specify download format, quality, titles, and path. There's information on how to do that in the youtube-dl readme.

By default, it downloads 40 videos at once. Set your desired number of simultaneous downloads in the var `desiredSimultaneousDownloads` which is near the top of `ytdl-server.ts`. (Don't forget to run `tsc` after making changes, then run `node ytdl-server.js` again.)