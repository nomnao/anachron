// The people in ChitChat Messenger's contact list. None of them are
// real: they're the same regulars who hang out on ANACHRON's web
// (the chat room, GeoVillage...), plus Coo. Each one has a status,
// a personal message, and a few things they say.
//
// replies: words to listen for, and what they might answer (one is
// picked at random). {name} becomes your display name.
// Lines can have emoticons in them, like :) or <3.

// Things everyone says, when they don't have their own answer
const COMMON_REPLIES = [
  { words: ['hi', 'hello', 'hey', 'hiya', 'yo', 'sup'], answers: ['hey {name}!', 'hi {name} :)', 'heyyy'] },
  { words: ['how are you', 'how r u', 'hru', "what's up", 'wassup'], answers: ['good thx! u?', 'pretty good :D', 'bored lol. u?'] },
  { words: ['bye', 'cya', 'gtg', 'g2g', 'goodnight', 'night'], answers: ['bye {name}! :)', 'cya later', 'nite nite!'] },
  { words: ['lol', 'haha', 'rofl', 'lmao'], answers: ['lol', 'hehe :P', 'haha'] },
  { words: ['thanks', 'thank you', 'thx', 'ty'], answers: ['np!', 'anytime :)'] },
  { words: ['love', '<3'], answers: ['aww <3', ':$ hehe'] },
  { words: [':(', 'sad', 'bored'], answers: ['aww cheer up :)', 'wanna play minesweeper?'] },
];

export const CONTACTS = [
  {
    id: 'coo',
    name: 'Coo',
    color: '#7d8599',
    letter: 'C',
    status: 'online',
    message: 'Ask me for a tip!',
    replies: [
      { words: ['tip', 'help', 'how', 'idea'], answers: [
        'Tip: in Solitaire, right-click the green table to send cards up to the top!',
        'Tip: press N in Minesweeper, Solitaire or Snake for a new game.',
        'Tip: right-click a picture and choose Set as Wallpaper. Very stylish!',
        'Tip: the speaker next to the clock turns the sound off and on.',
        'Tip: drag the edges of a window to make it bigger.',
      ] },
      { words: ['pigeon', 'bird', 'birds'], answers: [
        'Did you know pigeons can find their way home from far, far away? :D',
        'Pigeons bob their heads to keep their view steady. Bob bob!',
      ] },
      { words: ['pet', 'pets'], answers: ['My cousin Pidge is waiting at www.pixelpets.web <3'] },
    ],
    fallback: ['Coo coo! (That means "interesting!")', 'Hmm, let me think about that... coo.', 'Ask me for a tip any time :)'],
    nudgeReply: 'Whoa! You ruffled my feathers :O',
  },
  {
    id: 'pixel',
    name: 'PixelPrincess',
    color: '#c040c0',
    letter: 'P',
    status: 'online',
    message: '~*~ making my homepage sparkle ~*~',
    // She says hello first, a little while after you sign in
    opener: { after: 25000, text: 'hiii {name}! r u there? :)' },
    replies: [
      { words: ['homepage', 'page', 'website', 'site'], answers: ['mine has a purple starry background and a guestbook!! <3', 'u should make one on geovillage.web'] },
      { words: ['blink', 'html'], answers: ['i still cant make text blink :( help'] },
      { words: ['yes', 'yeah', 'yep', 'here'], answers: ['yay :D whatcha doing?'] },
    ],
    fallback: ['omg same', 'hehe :P', 'cool cool', 'wait what lol'],
    nudgeReply: 'HEY no nudging!! :P',
  },
  {
    id: 'mike',
    name: 'ModemMike',
    color: '#208020',
    letter: 'M',
    status: 'away',
    message: "brb, mom's on the phone",
    // Comes back after a while, then nudges you for fun
    becomes: { after: 40000, status: 'online', message: 'connected at 28.8 baby!!' },
    nudge: { after: 60000, text: 'lol sorry, had to try the nudge button' },
    replies: [
      { words: ['modem', 'internet', 'slow', 'fast'], answers: ['my modem screams like a robot cat :O', 'pages load so fast now. like 2 minutes each'] },
      { words: ['phone', 'mom'], answers: ['she needs the phone line in 10 mins so i gotta be quick'] },
    ],
    fallback: ['ya', 'haha nice', 'hold on, page is loading...', 'brb'],
    awayReply: "(Auto-reply) I'm away from my computer right now. My mom needs the phone.",
    nudgeReply: 'ok ok im here!! :D',
  },
  {
    id: 'skater',
    name: 'SkaterBoi98',
    color: '#c03030',
    letter: 'S',
    status: 'offline',
    message: 'just landed a kickflip!!',
    becomes: { after: 15000, status: 'online' },
    replies: [
      { words: ['skate', 'skating', 'kickflip', 'board'], answers: ['kickflips are ez once u get it', 'i can ollie over a curb now B)'] },
      { words: ['game', 'games', 'minesweeper', 'snake', 'solitaire'], answers: ['snake on fast is impossible lol', 'i always lose at tic tac toe on arcade-online.web'] },
    ],
    fallback: ['lol', 'cool', 'sweet', 'for real?', 'k'],
    nudgeReply: 'dude :P',
  },
  {
    id: 'coofan',
    name: 'xX_Coo_Fan_Xx',
    color: '#2050c0',
    letter: 'X',
    status: 'busy',
    message: 'DO NOT DISTURB - Minesweeper on Expert',
    replies: [
      { words: ['coo', 'pigeon'], answers: ['COO IS THE BEST!!!! <3 <3', 'did u sign the guestbook on coo-fan-club.web??'] },
      { words: ['minesweeper', 'mine', 'expert'], answers: ['17 mines left... dont talk to me :O', 'NOOO i clicked a mine :('] },
    ],
    fallback: ["can't talk, playing minesweeper!!", 'busy busy busy', 'shh concentrating'],
    nudgeReply: 'AAAH u made me click a mine :(',
    // Busy: takes a while to answer
    slow: true,
  },
  {
    id: 'tommy',
    name: 'Tommy (age 9)',
    color: '#c08000',
    letter: 'T',
    status: 'offline',
    message: 'DINOSAURS RULE!!!',
    becomes: { after: 70000, status: 'online' },
    opener: { after: 85000, text: 'hi!!! did u know birds are dinosaurs??' },
    replies: [
      { words: ['dinosaur', 'dinosaurs', 't-rex', 'trex', 'rex'], answers: [
        'T. rex teeth were as long as bananas!!!',
        'my favrite is triceratops. it has 3 horns',
        'stegosaurus had a tiny brain like a walnut lol',
      ] },
      { words: ['bird', 'birds', 'pigeon', 'yes', 'no'], answers: ['its true!! so pigeons are dinosaurs. even coo :D'] },
      { words: ['school', 'homework'], answers: ['i have to do my homework after this :('] },
    ],
    fallback: ['cool!!', 'my dad says i can only be on for 10 more minutes', 'haha', 'ROAR :D'],
    nudgeReply: 'hahaha do it again!!',
  },
  {
    id: 'cathuman',
    name: "Whiskers' Human",
    color: '#e07020',
    letter: 'W',
    status: 'away',
    message: 'feeding Whiskers. again.',
    replies: [
      { words: ['cat', 'cats', 'whiskers', 'kitten'], answers: ['Whiskers is asleep on the monitor again :)', 'he sat on the keyboard and sent an email to my boss lol'] },
    ],
    fallback: ['sorry, Whiskers needed something', 'oh hi! :)', 'meow (that was Whiskers)'],
    awayReply: "(Auto-reply) Away: Whiskers wants his dinner. Back soon!",
    nudgeReply: 'the nudge scared Whiskers off my lap :O',
  },
];

// What a contact says back to text you sent, or a random line of
// their own if nothing matched
export function replyTo(contact, text, myName) {
  const lower = ` ${text.toLowerCase()} `;
  const heard = (word) => {
    // Whole words only ("hi" mustn't match "this"), except emoticons
    if (/^[a-z' -]+$/.test(word)) return new RegExp(`[^a-z]${word}[^a-z]`).test(lower);
    return lower.includes(word);
  };

  const match = [...contact.replies, ...COMMON_REPLIES].find((reply) => reply.words.some(heard));
  const choices = match ? match.answers : contact.fallback;
  return pick(choices).replaceAll('{name}', myName);
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}
