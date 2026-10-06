-- Profile photo hosted on UploadThing: the public URL is shown in the apps, the key is needed to delete the old file.
ALTER TABLE users ADD COLUMN photo_url text;
ALTER TABLE users ADD COLUMN photo_key text;
