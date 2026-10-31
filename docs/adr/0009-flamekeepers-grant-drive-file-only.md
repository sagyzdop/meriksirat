# Flamekeepers grant only the drive.file scope

Flamekeepers grant the non-sensitive `drive.file` scope and nothing broader. The
full `drive` scope is restricted, which means a restricted-scope review and a
paid CASA security assessment every year, a cost a student club can't carry.
`drive.file` reaches only the files the app created for that particular user, so
the server can't copy photos from one account to another. Moving a volume
therefore tries, in order: an in-org ownership transfer (if a spike shows the new
owner's token can still reach the file); a relay that runs in the browser, with
short-lived source and destination credentials; and finally deletion. No photo
bytes ever pass through the Worker, because the free Workers plan can't carry
that traffic.
