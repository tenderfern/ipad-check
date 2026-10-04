// Video set and version live here. Every page header, the version meta tag,
// and the ?v= query on CSS and JS links must use the same version string.
var TF_CONFIG = {
  version: "2026-10-03.1",
  storagePrefix: "tf-ipad-check",
  cookieName: "tf-ipad-check",
  idbName: "tf-ipad-check",
  idbStore: "pairing",
  apiScript: "https://www.youtube.com/iframe_api",
  watchOrigin: "https://www.youtube.com",
  nocookieOrigin: "https://www.youtube-nocookie.com",
  embedMessageOrigins: [
    "https://www.youtube.com",
    "https://www.youtube-nocookie.com",
  ],
  apiLoadTimeoutMs: 12000,
  guardIntervalMs: 500,
  cookieMaxAgeSeconds: 34560000,
  logMaxLines: 2000,
  modes: [
    {
      id: "api-default",
      label: "API, default host",
      detail:
        "new YT.Player, after the script from https://www.youtube.com/iframe_api. The host option is left unset, so the player uses its default.",
    },
    {
      id: "api-nocookie",
      label: "API, privacy-enhanced host",
      detail:
        "The same constructor, with host set to https://www.youtube-nocookie.com (the IFrame Player API reference lists width, height, videoId, playerVars and events, and does not list host). This page passes it anyway and records whether a player appears.",
    },
    {
      id: "plain",
      label: "Plain iframe",
      detail:
        "An iframe whose address is https://www.youtube-nocookie.com/embed/<id>, with playsinline=1. The API script is not requested. Messages from the embed origins are logged. None are sent, and enablejsapi is not set.",
    },
  ],
  videos: [
    {
      id: "_OBlgSz8sSM",
      caseName: "Made for kids",
      title: "Charlie bit my finger - again !",
      channel: "HDCYT",
      length: "0:56",
      why: "The uploader writes that YouTube set this video to made for kids, and that comments are off. A desktop embed plays it.",
      checked:
        "On 2026-10-03, oEmbed returned this title and the channel HDCYT. The watch page reported lengthSeconds 56, playability OK and playableInEmbed true. The description says YouTube set the video to made for kids and that comments are turned off. isMadeForKids was not in the HTML. A desktop API load, default host and privacy-enhanced host, reached playing. The plain iframe showed this video's poster. Playback inside that frame was not confirmed from the desktop check. Numberblocks (01ATSHhxwCc) reported playableInEmbed true the same day, and a desktop API load logged error 150 and showed This video is unavailable, so it is not the specimen.",
    },
    {
      id: "0e3GPea1Tyg",
      caseName: "Monetized, long enough for a mid-roll",
      title: "$456,000 Squid Game In Real Life!",
      channel: "MrBeast",
      length: "25:41",
      why: "A long upload from a channel that sells sponsors. Whether an ad actually plays is what run C is for.",
      checked:
        "On 2026-10-03, oEmbed returned this title and the channel MrBeast. The watch page reported lengthSeconds 1541 (25:41), category Entertainment, playability OK and playableInEmbed true. The description includes a sponsor line and a show plug. A desktop API load, default host and privacy-enhanced host, reached playing. The plain iframe showed the poster. An ad impression was not verified. Gangnam Style (9bZkp7q19f0, officialpsy) was checked the same day and is 4:12, so it is a weak mid-roll specimen and is not in this set.",
    },
    {
      id: "h6fcK_fRYaI",
      caseName: "End screen and cards",
      title: "The Egg - A Short Story",
      channel: "Kurzgesagt – In a Nutshell",
      length: "8:06",
      suggestedStart: 450,
      startHint: "7:30 of 8:06",
      why: "A creator video. The watch-page payload names an end-screen renderer. The last seconds were not watched.",
      checked:
        "On 2026-10-03, oEmbed returned this title and the channel Kurzgesagt – In a Nutshell. The watch page reported lengthSeconds 486, category Education, playability OK and playableInEmbed true. That page's payload included the name endscreenElementRenderer. Charlie bit my finger, the made-for-kids case, did not, and neither did Numberblocks (01ATSHhxwCc). Confirm the end-screen elements on the first baseline run, with the guard off. The last seconds were not watched. Start at 450 seconds to reach the end quickly.",
    },
    {
      id: "pVRefGmQDJM",
      caseName: "Short",
      title: "How to Write Clearly Without Overloading Readers #tips",
      channel: "Document360",
      length: "0:27",
      why: "A Short. Its canonical address is the shorts page.",
      checked:
        "On 2026-10-03, oEmbed returned this title and the channel Document360. The watch page reported lengthSeconds 27, isShortsEligible true, playableInEmbed true, and a canonical address of the shorts page for this id. The description was empty and the like count on the page was 4, so the upload may not stay up. Substitute another Short if it does not load. A desktop API load from 20 seconds reached playing, then ended, and with the guard on the page removed the player.",
    },
    {
      id: "s5qx1X78ujE",
      caseName: "Embedding turned off",
      title: "МОЛЧАНИЕ - Серия 1 / Детектив / СМОТРИТЕ на EPIC+",
      channel: "Epic Media",
      length: "49:48",
      why: "playableInEmbed is false, and oEmbed refuses the id.",
      caution: "Expect an error, 101 or 150, rather than playback.",
      checked:
        "On 2026-10-03, oEmbed returned 401 Unauthorized, so it did not provide a title or channel. The watch page title and channel are Epic Media's, lengthSeconds 2988, playability OK on the watch page, and playableInEmbed false. A desktop API load logged error 150. The plain iframe showed that playback on other websites has been disabled by the video owner.",
    },
    {
      id: "mJgC9LEBTuQ",
      caseName: "Age-restricted",
      title: "Zordon is a Racist",
      channel: "Dropout",
      length: "2:49",
      why: "The watch page requires a login to confirm age.",
      caution:
        "Age-gated comedy sketch. The embed is expected to refuse playback or send the viewer away. This check has not played it.",
      checked:
        "On 2026-10-03, oEmbed returned this title and the channel Dropout. The watch page reported lengthSeconds 169 and playability LOGIN_REQUIRED, with an age-confirmation gate (desktopLegacyAgeGateReason). The description's first line is the sketch's joke. The video was not played.",
    },
    {
      id: "00000000000",
      caseName: "Id that does not exist",
      title: "(no video)",
      channel: "(none)",
      length: "—",
      why: "oEmbed returns 404 and the watch page says the video is unavailable.",
      caution:
        "The API reference names error 100 for a video that was not found. A desktop API load of this id logged 150, and the same 150 for other unknown ids. The frame showed Video unavailable. Record the code on the iPad.",
      checked:
        "On 2026-10-03, oEmbed returned 404 Not Found. The watch page playability status was ERROR, reason “This video is unavailable”. The id 99fakeID999 is also unavailable, but oEmbed returns 400 for it, so it is not the id used here. A desktop API load logged error 150, and so did xxxxxxxxxxx, 99fakeID999 and aaaaaaaaaaa. The frame said Video unavailable, which is a different sentence from the embedding-disabled video.",
    },
  ],
};
