// Everything you need to personalise lives here.
export const CONFIG = {
  name: "Karim",
  from: "Dana", // signs the last page: "— me"
  // Local time, no "Z" at the end. Format: YYYY-MM-DDTHH:mm:ss
  birthDate: "1999-10-23T08:30:00",
  candles: 6, // 1-12
  song: "musicbox" as "musicbox" | "classic", // "musicbox" = music-box waltz, "classic" = the original plain tune
  photo: "/guest.png", // any photo, put it in /public
  caption: "Little you is so proud of the big you. I love you.",
  // Real little moments work best. Replace these.
  notes: [
    "A song reminded me of you.",
    "The sunset was so pretty, I thought of you.",
    "I saw our favorite place today. I wish you were there.",
    "Can't wait to see you again.",
  ],
  envelopes: [
    { label: "open when you miss me", msg: "Look up. Same moon, I promise." },
    { label: "open when you need a laugh", msg: "Remember the thing. You know the thing." },
    { label: "open when it's a hard day", msg: "You've made it through every one so far." },
    { label: "open on your birthday", msg: "Dinner is on me. Pick anywhere." },
  ],
};
