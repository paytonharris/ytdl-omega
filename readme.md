

# notes

All database items need a priority. They should have a default priority of 100, so that lower numbers get queued before them.

# todo:
Put the video name, upload date, and view count into the mongo db? So I can query it later?
Put the date as the first part of the file title for each video so i can sort by date.

bug: it got 46 downloads started when the desired number was 40.
need to move the `getCodesIsRunning = false;` to the callback of the last setTimeout.