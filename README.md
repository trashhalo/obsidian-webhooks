# Obsidian Webhooks

Obsidian plugin and service that connects your editor to the internet of things through webhooks

## Example Use cases

- add quick thoughts to your notes by talking to your Google assistant
- capture a note every time you like a song on Spotify
- capture a note every time you react to a slack message with a pencil emoji
- change or add notes any time you do any action on any other app

## Setting up an example rule

1. Install the obsidian plugin from releases
2. Go to https://obsidian-buffer.web.app to signup for the service
3. Generate a login token and install it into the webhook plugin settings in Obsidian
4. Use the webhook url on the service website with your favorite automation service
5. For the spotify example usecase connect IFTTT to spotify
6. Create an applet that connects `new saved track` event to webhooks service
7. Paste the webhook url into the service url
8. Change the content type to text/plain
9. Change the method type to POST
10. In the request body you can now type markdown to be appended to a note, be sure to use the ingredients button to reference information from the spotify event.

My rule is set to append:

```markdown
- [[{{Spotify.newSavedTrack.ArtistName}}]] [[{{Spotify.newSavedTrack.AlbumName}}]] - {{Spotify.newSavedTrack.TrackName}}
```
