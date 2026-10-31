# Flamekeepers grant only drive.file; photos move through the browser

Flamekeepers grant the non-sensitive `drive.file` scope and nothing broader. The
full `drive` scope is restricted, which means a restricted-scope review and a
paid CASA security assessment every year, a cost a student club can't carry.
Under `drive.file` the server can't copy a photo between accounts, and the spike
showed that an ownership transfer leaves the file invisible to the new owner's
token. Moving a photo is therefore a browser relay: the browser downloads it
with the source flamekeeper's short-lived access token and uploads it straight
into the album folder through a resumable session minted for the destination
flamekeeper. The photo gets a new Drive file ID. No photo bytes ever pass
through the Worker, because the free Workers plan can't carry that traffic. If
no browser runs the relay before the deadline, the photos are deleted.
