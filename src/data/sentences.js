// ─────────────────────────────────────────────────────────────────────────────
// A2 Present Simple – Subject–Verb Agreement
// ─────────────────────────────────────────────────────────────────────────────
//
// Six question pools (multiChoice, multiChoiceVerbPatterns, gapFill,
// gapFillContinuous, gapFillPast, gapFillVerbPatterns) live in the shared
// JSON file below so both client and server consume the same source.
// Edit `./questions.json` to change them.
import questionData from './questions.json';

/** Gap-fill sentences: verb removed, shown in parentheses. Used in Gap Fill mode. */
export const gapFill = questionData.gapFill;

/**
 * Multiple-choice sentences: verb slot shows the infinitive as a hint.
 * options: always [base/plural form, third-person-singular form]
 * answer: the correct choice
 */
export const multiChoice = questionData.multiChoice;

/** Sentences with deliberate subject–verb agreement mistakes. Used in Correction mode. */
export const correctionSentences = [
  "My brother play football every Saturday.",
  "The students studies English after lunch.",
  "She walk to school with her friend.",
  "The dog sleep under the table.",
  "My parents works in an office near the city centre.",
  "The teacher give us homework every day.",
  "Tom and Jerry watches cartoons in the evening.",
  "The baby cry when she is hungry.",
  "Our neighbours has a big garden.",
  "The bus stop near my house every morning.",
  "My sister like chocolate ice cream.",
  "The children runs in the playground during break time.",
  "His father drive to work very early.",
  "The cats sits on the wall in the afternoon.",
  "My best friend live near the library.",
  "The shops opens at nine o'clock.",
  "The sun rise in the east.",
  "Our class start at eight thirty.",
  "My cousins visits us on Sundays.",
  "The boy with the red backpack carry a heavy bag to school.",
];

/** Completed correct sentences. Reference / answer key. */
export const correctSentences = [
  "My brother plays football every Saturday.",
  "The students study English after lunch.",
  "She walks to school with her friend.",
  "The dog sleeps under the table.",
  "My parents work in an office near the city centre.",
  "The teacher gives us homework every day.",
  "Tom and Jerry watch cartoons in the evening.",
  "The baby cries when she is hungry.",
  "Our neighbours have a big garden.",
  "The bus stops near my house every morning.",
  "My sister likes chocolate ice cream.",
  "The children run in the playground during break time.",
  "His father drives to work very early.",
  "The cats sit on the wall in the afternoon.",
  "My best friend lives near the library.",
  "The shops open at nine o'clock.",
  "The sun rises in the east.",
  "Our class starts at eight thirty.",
  "My cousins visit us on Sundays.",
  "The boy with the red backpack carries a heavy bag to school.",
];

// ─── Wheel Mode — Present Simple ─────────────────────────────────────────────

/** Incorrect Present Simple sentences for use as distractors in Wheel mode. */
// ─── Shared Correct Sentence Pools (by tense) ────────────────────────────────
// Used by both Reorder and Wheel games. Each pool combines sentences from both games
// to provide broader variety (20 from Reorder + 20 from Wheel = 40 per tense).

/** Correct Present Simple sentences — shared pool for Reorder and Wheel. */
export const correctSentencesPresentSimple = [
  // From original Reorder pool
  "My brother plays football every Saturday.",
  "The students study English after lunch.",
  "She walks to school with her friend.",
  "The dog sleeps under the table.",
  "My parents work in an office near the city centre.",
  "The teacher gives us homework every day.",
  "Tom and Jerry watch cartoons in the evening.",
  "The baby cries when she is hungry.",
  "Our neighbours have a big garden.",
  "The bus stops near my house every morning.",
  "My sister likes chocolate ice cream.",
  "The children run in the playground during break time.",
  "His father drives to work very early.",
  "The cats sit on the wall in the afternoon.",
  "My best friend lives near the library.",
  "The shops open at nine o'clock.",
  "The sun rises in the east.",
  "Our class starts at eight thirty.",
  "My cousins visit us on Sundays.",
  "The boy with the red backpack carries a heavy bag to school.",
  // From Wheel pool
  "I wake up at seven every morning.",
  "She drinks tea with her breakfast.",
  "They live near the city centre.",
  "He works in a small office.",
  "We play board games on weekends.",
  "My brother studies English after dinner.",
  "The dog sleeps under the table.",
  "My parents cook dinner together.",
  "The teacher checks our homework carefully.",
  "The children ride their bikes after school.",
  "Do you like cold weather?",
  "Does she work on Saturdays?",
  "Where do they buy fresh fruit?",
  "Why does he wear glasses?",
  "When do your neighbours visit you?",
  "I don't eat fast food very often.",
  "She doesn't drive to work every day.",
  "They don't watch TV in the morning.",
  "He doesn't forget his keys anymore.",
  "We don't need extra chairs today.",
];

/**
 * Gap-fill sentences for Past Simple.
 * Only the main verb is removed; regular -ed forms plus the irregular "shone".
 * answer = past simple form of the verb.
 */
export const gapFillPast = questionData.gapFillPast;

/**
 * Gap-fill sentences for Present Continuous.
 * The auxiliary AND main verb are removed; the infinitive is shown in parentheses.
 * answer = full present-continuous form (auxiliary + -ing verb).
 */
export const gapFillContinuous = questionData.gapFillContinuous;

/**
 * Correction-mode sentences: deliberately wrong verb form.
 * wrongWordIndex = 0-based index in the split-by-space word array.
 * wrongWord = the erroneous form already in the sentence.
 * answer = the correct form the student must type.
 */
export const correction = [
  { sentence: "My brother play football every Saturday.",                   wrongWordIndex: 2, wrongWord: "play",    answer: "plays"   },
  { sentence: "The students studies English after lunch.",                  wrongWordIndex: 2, wrongWord: "studies", answer: "study"   },
  { sentence: "She walk to school with her friend.",                        wrongWordIndex: 1, wrongWord: "walk",    answer: "walks"   },
  { sentence: "The dog sleep under the table.",                             wrongWordIndex: 2, wrongWord: "sleep",   answer: "sleeps"  },
  { sentence: "My parents works in an office near the city centre.",        wrongWordIndex: 2, wrongWord: "works",   answer: "work"    },
  { sentence: "The teacher give us homework every day.",                    wrongWordIndex: 2, wrongWord: "give",    answer: "gives"   },
  { sentence: "Tom and Jerry watches cartoons in the evening.",             wrongWordIndex: 3, wrongWord: "watches", answer: "watch"   },
  { sentence: "The baby cry when she is hungry.",                           wrongWordIndex: 2, wrongWord: "cry",     answer: "cries"   },
  { sentence: "Our neighbours has a big garden.",                           wrongWordIndex: 2, wrongWord: "has",     answer: "have"    },
  { sentence: "The bus stop near my house every morning.",                  wrongWordIndex: 2, wrongWord: "stop",    answer: "stops"   },
  { sentence: "My sister like chocolate ice cream.",                        wrongWordIndex: 2, wrongWord: "like",    answer: "likes"   },
  { sentence: "The children runs in the playground during break time.",     wrongWordIndex: 2, wrongWord: "runs",    answer: "run"     },
  { sentence: "His father drive to work very early.",                       wrongWordIndex: 2, wrongWord: "drive",   answer: "drives"  },
  { sentence: "The cats sits on the wall in the afternoon.",                wrongWordIndex: 2, wrongWord: "sits",    answer: "sit"     },
  { sentence: "My best friend live near the library.",                      wrongWordIndex: 3, wrongWord: "live",    answer: "lives"   },
  { sentence: "The shops opens at nine o'clock.",                           wrongWordIndex: 2, wrongWord: "opens",   answer: "open"    },
  { sentence: "The sun rise in the east.",                                  wrongWordIndex: 2, wrongWord: "rise",    answer: "rises"   },
  { sentence: "Our class start at eight thirty.",                           wrongWordIndex: 2, wrongWord: "start",   answer: "starts"  },
  { sentence: "My cousins visits us on Sundays.",                           wrongWordIndex: 2, wrongWord: "visits",  answer: "visit"   },
  { sentence: "The boy with the red backpack carry a heavy bag to school.", wrongWordIndex: 6, wrongWord: "carry",   answer: "carries" },
];

/** Correct Present Continuous sentences — shared pool for Reorder and Wheel. */
export const correctSentencesPresentContinuous = [
  // From original Reorder pool
  "I am reading a book right now.",
  "She is talking on the phone at the moment.",
  "They are playing football in the park.",
  "The teacher is writing on the board.",
  "We are watching a film together.",
  "My mum is cooking dinner in the kitchen.",
  "The children are drawing pictures in class.",
  "He is listening to music with his headphones.",
  "Tom and his brother are cleaning their room.",
  "The dog is barking at the cat.",
  "I am waiting for the bus outside.",
  "The students are working on their homework.",
  "My friend is wearing a blue jacket today.",
  "The baby is sleeping in the bedroom.",
  "We are learning new words in English class.",
  "The sun is shining brightly today.",
  "My parents are talking to our neighbours.",
  "She is carrying a heavy bag.",
  "The boys are running around the playground.",
  "Our class is doing a listening exercise now.",
  // From Wheel pool
  "She is cooking dinner in the kitchen now.",
  "I am playing football with my friends.",
  "They are watching TV at the moment.",
  "He is doing his homework right now.",
  "We are waiting for the teacher.",
  "My sister is talking on the phone.",
  "The dog is barking at the door.",
  "Tom is running in the playground.",
  "The children are drawing pictures.",
  "My parents are sitting in the living room.",
  "Are you listening to music now?",
  "Is she coming to the party?",
  "Am I standing in the right place?",
  "Are the buses stopping here?",
  "Is he wearing a jacket today?",
  "Are the babies sleeping now?",
  "Is she going the right way?",
  "Are they cleaning their room?",
  "Is he waiting outside?",
  "Are your brothers studying English?",
];

/** Correct Past Simple sentences — shared pool for Reorder and Wheel. */
export const correctSentencesPastSimple = [
  // From original Reorder pool
  "I watched a film last night.",
  "She visited her grandmother on Sunday.",
  "They played football after school.",
  "The teacher explained the homework clearly.",
  "We walked to the park yesterday.",
  "My dad fixed the broken chair.",
  "The children laughed at the funny story.",
  "He washed his car in the morning.",
  "Tom and his sister helped their mum in the kitchen.",
  "The dog chased the ball across the yard.",
  "I finished my homework before dinner.",
  "The students answered the questions quickly.",
  "My friend opened the window because it was hot.",
  "The baby cried loudly during the night.",
  "We visited the museum last weekend.",
  "The sun shone brightly all day.",
  "My parents cooked a big meal for the family.",
  "She carried her books to the classroom.",
  "The boys jumped over the puddle.",
  "Our class started the lesson at nine o'clock.",
  // From Wheel pool
  "I lost my keys on the way to school.",
  "She didn't finish her lunch yesterday.",
  "They visited their cousins during the holidays.",
  "We didn't hear the phone ring.",
  "He found a coin on the ground.",
  "The children built a sandcastle at the beach.",
  "My aunt sent me a birthday card.",
  "The bus arrived ten minutes late.",
  "I didn't understand the last question.",
  "She wore a red dress to the party.",
  "Did you see the new film last weekend?",
  "Did he clean his room before dinner?",
  "Where did they stay during their trip?",
  "Why did she leave the meeting early?",
  "When did the shop open yesterday?",
  "The teacher chose three students to help.",
  "We didn't bring enough snacks for everyone.",
  "My neighbour grew tomatoes in his garden.",
  "The baby slept for three hours.",
  "Our team won the game last Friday.",
];

// ─── Correct sentences for new tenses ─────────────────────────────────────────

/** Correct Past Continuous sentences — shared pool for Reorder and Wheel. */
export const correctSentencesPastContinuous = [
  "She was cooking dinner when I arrived.",
  "I was playing football at five o'clock.",
  "They were watching TV when the phone rang.",
  "He was doing his homework last night.",
  "We were waiting for the bus in the rain.",
  "My sister was talking to her teacher.",
  "The dog was barking at the stranger.",
  "Tom was running in the park.",
  "The children were drawing pictures in class.",
  "My parents were sitting in the garden.",
  "Was she wearing a coat yesterday evening?",
  "Were they watching the film when you called?",
  "Was he sleeping at midnight?",
  "Were the buses stopping near your house?",
  "Were you walking to school at eight?",
  "Was the baby crying loudly?",
  "Were we driving too fast?",
  "Was she carrying a heavy bag?",
  "Were they waiting for the train?",
  "Were your brothers studying last night?",
];

/** Correct Present Perfect sentences — shared pool for Reorder and Wheel. */
export const correctSentencesPresentPerfect = [
  "She has finished her homework already.",
  "I have lost my phone today.",
  "They have visited that museum before.",
  "He has cleaned his room this morning.",
  "We have seen that film many times.",
  "My sister has broken her glasses.",
  "The dog has eaten my sandwich.",
  "Tom has written three emails today.",
  "The children have taken the books home.",
  "My parents have bought a new table.",
  "Have you finished your project yet?",
  "Has she called you this morning?",
  "Have they washed their hands?",
  "Has he seen my keys anywhere?",
  "Have the teachers checked the answers?",
  "Have the students opened their books?",
  "Has she told you the news?",
  "Have they found the missing bag?",
  "Has your brother spoken to the manager?",
  "Have we missed the bus?",
];

/** Correct Past Perfect sentences — shared pool for Reorder and Wheel. */
export const correctSentencesPastPerfect = [
  "She had gone home before the rain started.",
  "I had eaten breakfast before school.",
  "They had taken the wrong train.",
  "He had broken his phone before the trip.",
  "We had seen that film before.",
  "My sister had written a long message.",
  "The dog had dug a big hole.",
  "Tom had forgotten his keys at home.",
  "The children had drawn pictures earlier.",
  "My parents had bought new chairs.",
  "Had she finished her homework before dinner?",
  "Had they gone to the shop before it closed?",
  "Had he eaten lunch before the meeting?",
  "Had you spoken to the teacher earlier?",
  "Had the bus left before you arrived?",
  "Had the train left the station early?",
  "Had she done her homework before class?",
  "Had they broken the window earlier?",
  "Had your brother taken the book?",
  "Had we chosen the right answer?",
];

/**
 * Helper map: grammar point → correct sentence pool.
 * Used by Reorder and Wheel games.
 */
export const correctSentencesByGrammar = {
  'Present Simple':     correctSentencesPresentSimple,
  'Present Continuous': correctSentencesPresentContinuous,
  'Past Simple':        correctSentencesPastSimple,
  'Past Continuous':    correctSentencesPastContinuous,
  'Present Perfect':    correctSentencesPresentPerfect,
  'Past Perfect':       correctSentencesPastPerfect,
};

// ─── Wheel Mode — Incorrect sentence pools ────────────────────────────────────
// These are used only by Wheel mode as distractors. Separate from correct pools
// to maintain variety and difficulty balance.

/** Incorrect Present Simple sentences for Wheel mode. */
export const wheelWrongPresentSimple = [
  "My brother don't play football every Saturday.",
  "The students doesn't study English after lunch.",
  "She don't walk to school with her friend.",
  "The dog doesn't sleeps under the table.",
  "My parents doesn't work in an office.",
  "The teacher don't give us homework.",
  "Tom and Jerry watches cartoons tonight.",
  "The baby don't cry when tired.",
  "Our neighbours doesn't have a garden.",
  "The bus stop near my house early.",
  "My sister don't like ice cream.",
  "The children doesn't run in the playground.",
  "His father don't drive to work.",
  "The cats doesn't sit on the wall.",
  "My best friend don't live near the library.",
  "The shops doesn't open at nine.",
  "The sun don't rise in the east.",
  "Our class doesn't starts at eight.",
  "My cousins doesn't visit us on Sundays.",
  "I don't watches cartoons in the evening.",
  "She don't sleeps in the afternoon.",
  "They don't speaks English well.",
  "He don't goes to school every day.",
  "We don't plays football after school.",
  "My sister don't does her homework.",
  "The dog don't runs in the park.",
  "My parents doesn't cooks dinner.",
  "The teacher don't explains the lesson.",
  "Tom don't helps his mother.",
  "The children doesn't learns new words.",
];

/** Incorrect Present Continuous sentences for Wheel mode. */
export const wheelWrongPresentContinuous = [
  "I is reading a book right now.",
  "She are talking on the phone.",
  "They is playing football in the park.",
  "The teacher is write on the board.",
  "We is watching a film together.",
  "My mum are cooking dinner.",
  "The children is drawing pictures.",
  "He are listening to music.",
  "Tom and his brother is cleaning their room.",
  "The dog is barking the cat.",
  "I am read a book right now.",
  "She is talk on the phone at the moment.",
  "They are play football in the park.",
  "The teacher are write on the board.",
  "We is watch a film together.",
  "My mum is cook dinner in the kitchen.",
  "The children are draw pictures in class.",
  "He is listen to music with his headphones.",
  "Tom is clean his room right now.",
  "The dog are bark at the cat.",
  "I is watching TV right now.",
  "She are playing football.",
  "They is doing their homework.",
  "The baby are sleep in the bedroom.",
  "We is learning new words.",
  "The sun are shine brightly today.",
  "My parents is talk to our neighbours.",
  "She are carrying a heavy bag.",
  "The boys is running around.",
  "Our class are do a listening exercise.",
];

/** Incorrect Past Simple sentences for Wheel mode. */
export const wheelWrongPastSimple = [
  "I watch a film last night.",
  "She visits her grandmother on Sunday.",
  "They plays football after school.",
  "The teacher explain the homework.",
  "We walk to the park yesterday.",
  "My dad fixed a broken chair.",
  "The children laugh at the story.",
  "He wash his car in the morning.",
  "Tom and his sister helps their mother.",
  "The dog chase the ball.",
  "I finishes my homework before dinner.",
  "The students answer the questions quickly.",
  "My friend open the window.",
  "The baby cried loudly yesterday.",
  "We visit the museum last weekend.",
  "The sun shines brightly all day.",
  "My parents cooked a big meal.",
  "She carry her books to class.",
  "The boys jumps over the puddle.",
  "Our class starts the lesson.",
  "I am watched a film last night.",
  "She was visiting her grandmother.",
  "They was playing football.",
  "The teacher were explain the homework.",
  "We have walked to the park.",
  "My dad has fixed the chair.",
  "The children was laughing.",
  "He did wash his car.",
  "Tom and his sister has helped.",
  "The dog did chase the ball.",
];

/** Incorrect Past Continuous sentences for Wheel mode. */
export const wheelWrongPastContinuous = [
  "She cooking dinner when I arrived.",
  "I was play football at five o'clock.",
  "They was watching TV when the phone rang.",
  "He were doing his homework last night.",
  "We was waiting for the bus in the rain.",
  "My sister were talking to her teacher.",
  "The dog was bark at the stranger.",
  "Tom were running in the park.",
  "The children was drawing pictures in class.",
  "My parents was sitting in the garden.",
  "Was she wear a coat yesterday?",
  "Was they watching the film when you called?",
  "Were he sleeping at midnight?",
  "Was the buses stopping near your house?",
  "Was you walking to school at eight?",
  "Were the baby crying loudly?",
  "Was we driving too fast?",
  "Were she carrying a heavy bag?",
  "Was they waiting for the train?",
  "Were your brother studying last night?",
  "I not was listening to the teacher.",
  "She was not wear her glasses.",
  "They were not play football after school.",
  "He was not eating his lunch at noon.",
  "We were not watching the match.",
  "My mum was not cook dinner then.",
  "The students were not listen carefully.",
  "The cat was not sleeping on the chair.",
  "I were not writing my notes.",
  "She was not carry her umbrella.",
  "While I was walk home, it started to rain.",
  "The teacher was talk to the class when I entered.",
  "My friend was drive to work at that time.",
  "The sun was shine very brightly.",
  "We was walking to the station together.",
  "She were writing a message on her phone.",
  "They was reading books in the library.",
  "The dog was chase a bird.",
  "Tom and Ben was cleaning the windows.",
  "The baby were crying during the night.",
  "Why was he laugh when you saw him?",
  "What were they do when you arrived?",
  "Where was she go at six o'clock?",
  "Why were the children shout so loudly?",
  "What was your mother cook when you called?",
  "Where were they sit during the show?",
  "Why was the teacher speak so quickly?",
  "What were your friends watch on TV?",
  "Where was he run when it happened?",
  "Why were the birds fly so low?",
];

/** Incorrect Present Perfect sentences for Wheel mode. */
export const wheelWrongPresentPerfect = [
  "She have finished her homework already.",
  "I has lost my phone today.",
  "They has visited that museum before.",
  "He have cleaned his room this morning.",
  "We has seen that film many times.",
  "My sister have broken her glasses.",
  "The dog have eaten my sandwich.",
  "Tom have written three emails today.",
  "The children has taken the books home.",
  "My parents has bought a new table.",
  "Have she finished her project yet?",
  "Has they called you this morning?",
  "Have he washed his hands?",
  "Has you seen my keys anywhere?",
  "Have the teacher checked the answers?",
  "Has the students opened their books?",
  "Have she told you the news?",
  "Has they found the missing bag?",
  "Have your brother spoke to the manager?",
  "Has we missed the bus?",
  "I haven't saw that film before.",
  "She hasn't went to the dentist yet.",
  "They haven't took the test.",
  "He hasn't ate his lunch.",
  "We haven't did our homework yet.",
  "My mum hasn't make dinner yet.",
  "The children haven't broke the window.",
  "I haven't wrote the message.",
  "She hasn't gave me the book.",
  "They haven't drank the milk.",
  "I have finish my homework already.",
  "She has lose her wallet.",
  "They have buy new shoes.",
  "He has forget his password.",
  "We have choose the blue one.",
  "My friend has send me a photo.",
  "The baby has fall asleep.",
  "The teacher has give us extra work.",
  "I have readed five pages today.",
  "She has draw a picture for me.",
  "Where have you went this morning?",
  "Why has she took your pen?",
  "What have he ate today?",
  "Where has they gone after class?",
  "How many times have you did this exercise?",
  "Why have she broke the glass?",
  "What has he wrote on the board?",
  "Where have the children ran?",
  "Why has they left early?",
  "What have your friend said to you?",
];

/** Incorrect Past Perfect sentences for Wheel mode. */
export const wheelWrongPastPerfect = [
  "She had went home before the rain started.",
  "I had ate breakfast before school.",
  "They had took the wrong train.",
  "He had broke his phone last week.",
  "We had saw that film before.",
  "My sister had wrote a long message.",
  "The dog had dig a big hole.",
  "Tom had forget his keys at home.",
  "The children had drew pictures earlier.",
  "My parents had buy new chairs.",
  "Had she finished her homework before dinner?",
  "Had they went to the shop before it closed?",
  "Had he ate lunch before the meeting?",
  "Had you spoke to the teacher yesterday?",
  "Had left the bus before you arrived?",
  "Had the train leaved the station early?",
  "Had she did her homework before class?",
  "Had they broke the window earlier?",
  "Had your brother took the book?",
  "Had we chose the right answer?",
  "I hadn't saw that place before.",
  "She hadn't went to bed when I arrived.",
  "They hadn't did their homework.",
  "He hadn't ate anything all day.",
  "We hadn't wrote the report yet.",
  "My mum hadn't make dinner before we came home.",
  "The children hadn't broke the toy before yesterday.",
  "I hadn't gave him the message.",
  "She hadn't took her medicine.",
  "They hadn't drank enough water.",
  "I had finish my homework before dinner.",
  "She had lose her wallet before the trip.",
  "They had build a small house.",
  "He had forget the answer before the test.",
  "We had choose the red one earlier.",
  "My friend had send me an email.",
  "The baby had fall asleep before nine.",
  "The teacher had give us extra time.",
  "I had readed the first chapter.",
  "She had draw a map of the city.",
  "Why had she took my pen?",
  "Where had they went after lunch?",
  "What had he ate before the game?",
  "Why had you broke the glass?",
  "Where had the children ran?",
  "What had your friend wrote in the note?",
  "Why had they lefted so early?",
  "How many times had you did that task?",
  "Where had she drove before coming here?",
  "What had he gave to the teacher?",
];

/**
 * Helper map: grammar point → incorrect sentence pool for Wheel mode.
 */
export const wheelWrongByGrammar = {
  'Present Simple':     wheelWrongPresentSimple,
  'Present Continuous': wheelWrongPresentContinuous,
  'Past Simple':        wheelWrongPastSimple,
  'Past Continuous':    wheelWrongPastContinuous,
  'Present Perfect':    wheelWrongPresentPerfect,
  'Past Perfect':       wheelWrongPastPerfect,
};

// ─────────────────────────────────────────────────────────────────────────────
// Verb Patterns – to-infinitive, bare infinitive, or gerund
// ─────────────────────────────────────────────────────────────────────────────

/** Gap-fill: blank immediately followed by (infinitive) hint. Used in Gap Fill mode. */
export const gapFillVerbPatterns = questionData.gapFillVerbPatterns;

/**
 * Multiple-choice: 3 options per question (to-infinitive / bare infinitive / gerund).
 * answer may be slash-separated when both to-infinitive and gerund are equally correct.
 */
export const multiChoiceVerbPatterns = questionData.multiChoiceVerbPatterns;
