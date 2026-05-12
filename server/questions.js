'use strict';

/**
 * questions.js — Server-side copy of multiplayer-eligible question pools.
 *
 * Mirrors the relevant exports from src/data/sentences.js in CommonJS format
 * (the client uses ES modules; the server uses CommonJS).
 *
 * Keep this file in sync with sentences.js whenever new question sets are added.
 * The pools used here are keyed by grammar name, matching the GameSelector grammar
 * dial values.
 */

// ── Present Simple — Multichoice ─────────────────────────────────────────────

const multiChoice = [
  { prompt: "My brother _____ football every Saturday.",                     options: ["play",  "plays"],   answer: "plays"   },
  { prompt: "The students _____ English after lunch.",                       options: ["study", "studies"], answer: "study"   },
  { prompt: "She _____ to school with her friend.",                          options: ["walk",  "walks"],   answer: "walks"   },
  { prompt: "The dog _____ under the table.",                                options: ["sleep", "sleeps"],  answer: "sleeps"  },
  { prompt: "My parents _____ in an office near the city centre.",           options: ["work",  "works"],   answer: "work"    },
  { prompt: "The teacher _____ us homework every day.",                      options: ["give",  "gives"],   answer: "gives"   },
  { prompt: "Tom and Jerry _____ cartoons in the evening.",                  options: ["watch", "watches"], answer: "watch"   },
  { prompt: "The baby _____ when she is hungry.",                            options: ["cry",   "cries"],   answer: "cries"   },
  { prompt: "Our neighbours _____ a big garden.",                            options: ["have",  "has"],     answer: "have"    },
  { prompt: "The bus _____ near my house every morning.",                    options: ["stop",  "stops"],   answer: "stops"   },
  { prompt: "My sister _____ chocolate ice cream.",                          options: ["like",  "likes"],   answer: "likes"   },
  { prompt: "The children _____ in the playground during break time.",       options: ["run",   "runs"],    answer: "run"     },
  { prompt: "His father _____ to work very early.",                          options: ["drive", "drives"],  answer: "drives"  },
  { prompt: "The cats _____ on the wall in the afternoon.",                  options: ["sit",   "sits"],    answer: "sit"     },
  { prompt: "My best friend _____ near the library.",                        options: ["live",  "lives"],   answer: "lives"   },
  { prompt: "The shops _____ at nine o'clock.",                              options: ["open",  "opens"],   answer: "open"    },
  { prompt: "The sun _____ in the east.",                                    options: ["rise",  "rises"],   answer: "rises"   },
  { prompt: "Our class _____ at eight thirty.",                              options: ["start", "starts"],  answer: "starts"  },
  { prompt: "My cousins _____ us on Sundays.",                               options: ["visit", "visits"],  answer: "visit"   },
  { prompt: "The boy with the red backpack _____ a heavy bag to school.",    options: ["carry", "carries"], answer: "carries" },
];

// ── Verb Patterns — Multichoice ───────────────────────────────────────────────

const multiChoiceVerbPatterns = [
  { prompt: "My sister agreed _____ the dishes.",                          options: ["to wash",       "wash",       "washing"      ], answer: "to wash"          },
  { prompt: "They decided _____ early in the morning.",                   options: ["to leave",      "leave",      "leaving"      ], answer: "to leave"         },
  { prompt: "I hope _____ you again soon.",                               options: ["to see",        "see",        "seeing"       ], answer: "to see"           },
  { prompt: "We planned _____ our grandparents last weekend.",            options: ["to visit",      "visit",      "visiting"     ], answer: "to visit"         },
  { prompt: "He wants _____ a new bike.",                                 options: ["to buy",        "buy",        "buying"       ], answer: "to buy"           },
  { prompt: "She promised _____ me with my homework.",                    options: ["to help",       "help",       "helping"      ], answer: "to help"          },
  { prompt: "I forgot _____ the door last night.",                        options: ["to lock",       "lock",       "locking"      ], answer: "to lock"          },
  { prompt: "Please remember _____ your book tomorrow.",                  options: ["to bring",      "bring",      "bringing"     ], answer: "to bring"         },
  { prompt: "They managed _____ the project on time.",                    options: ["to finish",     "finish",     "finishing"    ], answer: "to finish"        },
  { prompt: "We expect _____ before lunch.",                              options: ["to arrive",     "arrive",     "arriving"     ], answer: "to arrive"        },
  { prompt: "I enjoy _____ football after school.",                       options: ["to play",       "play",       "playing"      ], answer: "playing"          },
  { prompt: "She avoided _____ to the angry customer.",                   options: ["to talk",       "talk",       "talking"      ], answer: "talking"          },
  { prompt: "He kept _____ the same question again and again.",           options: ["to ask",        "ask",        "asking"       ], answer: "asking"           },
  { prompt: "They suggested _____ a movie tonight.",                      options: ["to watch",      "watch",      "watching"     ], answer: "watching"         },
  { prompt: "I miss _____ my old friends.",                               options: ["to see",        "see",        "seeing"       ], answer: "seeing"           },
  { prompt: "She practised _____ English every day.",                     options: ["to speak",      "speak",      "speaking"     ], answer: "speaking"         },
  { prompt: "The teacher asked us _____ our books.",                      options: ["to open",       "open",       "opening"      ], answer: "to open"          },
  { prompt: "My mum told me _____ my room.",                             options: ["to clean",      "clean",      "cleaning"     ], answer: "to clean"         },
  { prompt: "They invited us _____ them for dinner.",                     options: ["to join",       "join",       "joining"      ], answer: "to join"          },
  { prompt: "He reminded me _____ my grandmother.",                      options: ["to call",       "call",       "calling"      ], answer: "to call"          },
  { prompt: "The coach encouraged us _____ again.",                      options: ["to try",        "try",        "trying"       ], answer: "to try"           },
  { prompt: "She warned him _____ careful on the road.",                 options: ["to be",         "be",         "being"        ], answer: "to be"            },
  { prompt: "He gave up _____ last year.",                               options: ["to smoke",      "smoke",      "smoking"      ], answer: "smoking"          },
  { prompt: "We carried on _____ after lunch.",                          options: ["to work",       "work",       "working"      ], answer: "working"          },
  { prompt: "I feel like _____ something sweet.",                        options: ["to eat",        "eat",        "eating"       ], answer: "eating"           },
  { prompt: "She refused _____ the question.",                           options: ["to answer",     "answer",     "answering"    ], answer: "to answer"        },
  { prompt: "I offered _____ her bags to the car.",                      options: ["to carry",      "carry",      "carrying"     ], answer: "to carry"         },
  { prompt: "He learned _____ when he was five.",                        options: ["to swim",       "swim",       "swimming"     ], answer: "to swim"          },
  { prompt: "They tried _____ the broken chair.",                        options: ["to fix",        "fix",        "fixing"       ], answer: "to fix"           },
  { prompt: "We need _____ before it gets dark.",                        options: ["to leave",      "leave",      "leaving"      ], answer: "to leave"         },
  { prompt: "She considered _____ to another city.",                     options: ["to move",       "move",       "moving"       ], answer: "moving"           },
  { prompt: "Would you mind _____ the window?",                          options: ["to close",      "close",      "closing"      ], answer: "closing"          },
  { prompt: "He spent two hours _____ his room.",                        options: ["to clean",      "clean",      "cleaning"     ], answer: "cleaning"         },
  { prompt: "They finished _____ the house yesterday.",                  options: ["to paint",      "paint",      "painting"     ], answer: "painting"         },
  { prompt: "Please stop _____ so much noise.",                          options: ["to make",       "make",       "making"       ], answer: "making"           },
  { prompt: "We began _____ for the test after dinner.",                 options: ["to study",      "study",      "studying"     ], answer: "to study/studying"   },
  { prompt: "She continued _____ even after the bell rang.",             options: ["to talk",       "talk",       "talking"      ], answer: "to talk/talking"     },
  { prompt: "I prefer _____ to school when the weather is nice.",        options: ["to walk",       "walk",       "walking"      ], answer: "to walk/walking"     },
  { prompt: "They started _____ a new bridge last year.",                options: ["to build",      "build",      "building"     ], answer: "to build/building"   },
  { prompt: "He likes _____ before going to bed.",                       options: ["to read",       "read",       "reading"      ], answer: "to read/reading"     },
  { prompt: "She loves _____ to music in the evening.",                  options: ["to listen",     "listen",     "listening"    ], answer: "to listen/listening" },
  { prompt: "I hate _____ up early on Sundays.",                         options: ["to wake",       "wake",       "waking"       ], answer: "to wake/waking"      },
  { prompt: "The teacher helped us _____ the problem.",                  options: ["to understand", "understand", "understanding"], answer: "to understand/understand" },
  { prompt: "She wanted me _____ a little longer.",                      options: ["to stay",       "stay",       "staying"      ], answer: "to stay"          },
  { prompt: "They needed us _____ the work today.",                      options: ["to finish",     "finish",     "finishing"    ], answer: "to finish"        },
  { prompt: "He encouraged his friend _____ for the job.",              options: ["to apply",      "apply",      "applying"     ], answer: "to apply"         },
  { prompt: "I reminded her _____ the email.",                          options: ["to send",       "send",       "sending"      ], answer: "to send"          },
  { prompt: "The coach taught us _____ the ball quickly.",              options: ["to pass",       "pass",       "passing"      ], answer: "to pass"          },
  { prompt: "She warned them _____ away from the dog.",                 options: ["to stay",       "stay",       "staying"      ], answer: "to stay"          },
];

// ── Pool map — keyed by grammar name (matches GameSelector grammar dial) ──────

const QUESTION_POOLS = {
  'Present Simple': multiChoice,
  'Verb Patterns':  multiChoiceVerbPatterns,
};

module.exports = { QUESTION_POOLS };
