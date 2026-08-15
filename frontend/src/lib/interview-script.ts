// The interviewer's script for /reviewer/my-interviews — edit this file to
// change what interviewers see, no other code needs to change. Bracketed
// placeholders like [cycle start date] are cycle-specific and should be
// filled in (or left as a visible reminder) each time a new cycle starts.

export interface ScriptQuestion {
  prompt: string
  // Optional prompts to reach for if the applicant's first answer was thin —
  // not meant to all be asked, just there when more depth is needed.
  followUps?: string[]
}

export interface ChallengeTrack {
  label: string
  followUps: string[]
}

export const INTRO_SPEECH = `
I will try to keep this part short, but I am just going to run through the job description, some basic requirements, and some information about the overall hiring process before we get started to make sure we're on the same page before we jump into the interview.

Just to clarify, we are here today for an interview for the [role] role in Generate that starts in [cycle start date] and extends through [cycle end date], with a weekly time commitment of roughly [X] hours per week. Does that still sound like something you are willing and able to commit to?

As for the hiring process, we'll be conducting interviews until roughly [interview deadline], at which point I will be working with the rest of the team to make decisions, and acceptance emails should go out at some point before the [semester] starts. Does that all sound ok?

As a reminder, this position is only for students that will be in Boston for the entirety of the [semester] semester. If this is not your case, sadly we will not be able to continue with your candidacy. Can you confirm you will be in Boston for the entire semester (not counting breaks and weekends)?

Now, for the structure of the interview I am going to be asking a few questions that directly relate to the role. The goal of these is absolutely not to put you on the spot, so I highly encourage you to take as much time as needed to prepare your response, and let me know when you're ready. After I ask these questions I will leave plenty of time at the end of the interview for you to ask me questions, whether they be about the role, the organization, or literally anything else.

I expect this interview to take about 30 minutes, but it's important to me that I get a holistic view of your application, so if we go over by any amount that is totally fine.

And just so you know, I will be taking notes as fast as possible during the interview, so if I am looking down at my keys or am on mute or there's an awkward pause after your response just know that's what I'm up to, not anything else.

Do you have any questions about the interview or hiring process?
`.trim()

export const RECORDING_REMINDER =
  'Hit record (choose cloud recording) before moving on to the questions below.'

export const QUESTIONS: ScriptQuestion[] = [
  {
    prompt: 'Tell us about yourself.',
    followUps: [
      'What drew you to this role in particular?',
      'How did that background shape what you’re looking for here?',
    ],
  },
  {
    prompt: 'Why do you want to join Generate?',
    followUps: [
      'What about our specific projects or mission stood out to you?',
      'Is there anything about the program structure you’re still unsure about?',
    ],
  },
  {
    prompt:
      'Describe a good or bad experience you had working on a team. Why was that experience positive/negative?',
    followUps: [
      'What would you have done differently, looking back?',
      'How did you address the situation in the moment?',
      'What did that experience teach you about your own working style?',
    ],
  },
  {
    prompt:
      'Tell me about a project you worked on in as much technical detail as possible. How did you solve the problems from that project?',
    followUps: [
      'What was specifically your contribution versus the rest of the team’s?',
      'What tradeoffs did you weigh when choosing your approach?',
      'How did you test or validate that it actually worked?',
      'What would you do differently if you started it again today?',
    ],
  },
  {
    prompt:
      'Tell us about a time when you challenged yourself. What was the outcome? This can be from a technical or non-technical experience.',
    followUps: [
      'What made it feel like a real stretch at the time?',
      'What did you do in the moment you got stuck?',
      'How has that changed how you approach hard problems now?',
    ],
  },
  {
    prompt:
      'What do you think is the most important quality of an effective engineer?',
    followUps: [
      'Can you give an example of a time you (or someone else) showed that quality?',
      'What tends to go wrong on a team when that quality is missing?',
    ],
  },
  {
    prompt: 'Is there anything else you’d like to share with us?',
  },
]

export const CLOSING_NOTE =
  'Thank you so much for the thorough answers! That’s all I have, so now I’d like to open the floor for you to rapid fire any questions you may have for me.'

export const CHALLENGE_INTRO =
  'Ask the applicant to pull up their code and share their screen. Pick and choose from the questions below rather than asking every one — keep an eye on time.'

// The Control Tower challenge (f26-technical-challenge) has two independent
// tracks; applicants pick either one regardless of role. The frontend/ops
// console spec was still a placeholder as of this writing, so those
// follow-ups are intentionally kept general — revisit once the real spec
// lands.
export const CHALLENGE_TRACKS: Record<'backend' | 'frontend', ChallengeTrack> =
  {
    backend: {
      label: 'Backend — Control Tower scheduler',
      followUps: [
        'Which challenge did you choose, and why this one in particular?',
        'Walk me through your scheduling approach — how do you decide which voyage goes to which gate each tick?',
        'How did you balance competing metrics like throughput, fairness, and SLA compliance against each other?',
        'How did you handle the multi-hop corridor voyages (the ones that need to pass through 2–3 gates in sequence)?',
        'What was your strategy for premium-hub SLA deadlines without starving the other hubs?',
        'How did you test your scheduler locally before running it against the real endpoints?',
        'Now that you look at it again, what would you improve about your approach?',
        'How did you leverage the provided docs (README, OpenAPI spec) to make development easier?',
      ],
    },
    frontend: {
      label: 'Frontend — operations console',
      followUps: [
        'Which challenge did you choose, and why this one in particular?',
        'Walk me through your solution — what were the key screens or interactions you built?',
        'What was your approach to visualizing the live expedition/scheduling data?',
        'If there was anything new you had to learn, how did you approach teaching yourself?',
        'What was the most challenging part of the challenge — how did you overcome it?',
        'Now that you look at it again, are there ways you could improve your solution?',
        'How did you leverage the provided materials to make the development process easier?',
      ],
    },
  }

export const AVAILABILITY_REMINDER =
  'Remind them to fill out the availability form on the email invite. We cannot place them on a team without this.'

export const POST_INTERVIEW_CHECKLIST: string[] = [
  'Stop the recording.',
  'In the Interview section above, summarize your thoughts in Comments.',
  'Set a Rating for this applicant.',
  'Add the recording link (and notes link, if you took any) before submitting.',
  'Submit the interview — this unlocks the recording reviewer’s review.',
]
