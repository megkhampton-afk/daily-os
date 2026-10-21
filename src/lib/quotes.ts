// Short, attributed excerpts. Works are included so quotes can be traced to
// their context rather than anonymous motivational-quote collections.
export const QUOTES = [
  { text: "It is good to have an end to journey toward; but it is the journey that matters, in the end.", author: "Ursula K. Le Guin", work: "The Left Hand of Darkness" },
  { text: "The only thing that makes life possible is permanent, intolerable uncertainty: not knowing what comes next.", author: "Ursula K. Le Guin", work: "The Left Hand of Darkness" },
  { text: "You cannot buy the revolution. You cannot make the revolution. You can only be the revolution.", author: "Ursula K. Le Guin", work: "The Dispossessed" },
  { text: "To light a candle is to cast a shadow.", author: "Ursula K. Le Guin", work: "A Wizard of Earthsea" },
  { text: "All that you touch You Change. All that you Change Changes you.", author: "Octavia E. Butler", work: "Parable of the Sower" },
  { text: "Tell me, what is it you plan to do with your one wild and precious life?", author: "Mary Oliver", work: "The Summer Day" },
  { text: "You must do the thing you think you cannot do.", author: "Eleanor Roosevelt", work: "You Learn by Living" },
  { text: "Nothing will work unless you do.", author: "Maya Angelou", work: "Wouldn't Take Nothing for My Journey Now" },
  { text: "No need to hurry. No need to sparkle. No need to be anybody but oneself.", author: "Virginia Woolf", work: "A Room of One's Own" },
  { text: "I am not afraid of storms, for I am learning how to sail my ship.", author: "Louisa May Alcott", work: "Little Women" },
  { text: "If there is no struggle there is no progress.", author: "Frederick Douglass", work: "West India Emancipation speech, 1857" },
  { text: "The impediment to action advances action. What stands in the way becomes the way.", author: "Marcus Aurelius", work: "Meditations, Book 5, translated by Gregory Hays" },
  { text: "Ever tried. Ever failed. No matter. Try again. Fail again. Fail better.", author: "Samuel Beckett", work: "Worstward Ho" },
  { text: "You are your best thing.", author: "Toni Morrison", work: "Beloved" },
  { text: "Not everything that is faced can be changed; but nothing can be changed until it is faced.", author: "James Baldwin", work: "As Much Truth as One Can Bear" },
  { text: "I dwell in Possibility.", author: "Emily Dickinson", work: "Poem 466" },
  { text: "Let everything happen to you: beauty and terror. Just keep going. No feeling is final.", author: "Rainer Maria Rilke", work: "Go to the Limits of Your Longing, translated by Joanna Macy and Anita Barrows" },
  { text: "While we are postponing, life speeds by.", author: "Seneca", work: "Letters to Lucilius, Letter 1" },
  { text: "We are all in the gutter, but some of us are looking at the stars.", author: "Oscar Wilde", work: "Lady Windermere's Fan" },
  { text: "For there is always light, if only we're brave enough to see it. If only we're brave enough to be it.", author: "Amanda Gorman", work: "The Hill We Climb" },
  { text: "My experience is what I agree to attend to.", author: "William James", work: "The Principles of Psychology" },
  { text: "To be hopeful in bad times is not just foolishly romantic.", author: "Howard Zinn", work: "You Can't Be Neutral on a Moving Train" },
  { text: "If you surrendered to the air, you could ride it.", author: "Toni Morrison", work: "Song of Solomon" },
  { text: "Men are disturbed not by things, but by the views which they take of things.", author: "Epictetus", work: "Enchiridion, Section 5, translated by Elizabeth Carter" },
] as const;

export function quoteForDay(date: Date) {
  // Calendar dates, not elapsed local milliseconds, keep the daily sequence
  // stable through daylight-saving changes and consistent across devices.
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const order = QUOTES.map((_, index) => index);
  // A shuffled deck gives every quote a turn with no adjacent repeats.
  let seed = 0x51f15e;
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  const index = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
  return QUOTES[order[index]];
}
