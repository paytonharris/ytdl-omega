

# notes

All database items need a priority. They should have a default priority of 100, so that lower numbers get queued before them.

works pretty well, but duplicate videos are getting queued because I need to add a column that says which videos are currently being downloaded. Right now it's only filtering out the ones that are finished. When getting the videos, it needs to mark it as "downloading".