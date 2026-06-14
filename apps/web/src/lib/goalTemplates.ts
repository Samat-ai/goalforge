export interface GoalTemplate {
  id: string
  category: 'health' | 'career' | 'learning' | 'finance' | 'relationships' | 'personal'
  icon: string
  title: string
  prompt: string
  timeframe: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export const goalTemplates: GoalTemplate[] = [
  // Health
  {
    id: 'health-5k',
    category: 'health',
    icon: '🏃',
    title: 'Run a 5K',
    prompt: 'I want to train for and complete my first 5K run. I am currently mostly sedentary and want to build up over 10 weeks using a run/walk interval plan, running 3 times per week.',
    timeframe: '10 weeks',
    difficulty: 'beginner',
  },
  {
    id: 'health-morning-workout',
    category: 'health',
    icon: '🏋️',
    title: 'Build a morning workout routine',
    prompt: 'I want to establish a consistent morning workout routine, exercising at least 4 days per week before work. I want to combine strength training and cardio and make it a lasting habit over 3 months.',
    timeframe: '3 months',
    difficulty: 'intermediate',
  },
  {
    id: 'health-lose-weight',
    category: 'health',
    icon: '⚖️',
    title: 'Lose 10 pounds',
    prompt: 'I want to lose 10 pounds in a healthy, sustainable way over the next 3 months through a combination of calorie awareness, regular exercise 4-5 times per week, and reducing processed food intake.',
    timeframe: '3 months',
    difficulty: 'intermediate',
  },
  {
    id: 'health-meditate',
    category: 'health',
    icon: '🧘',
    title: 'Meditate daily for 90 days',
    prompt: 'I want to build a daily meditation habit over 90 days, starting with just 5 minutes per day and gradually working up to 20 minutes. I want to reduce stress and improve mental clarity.',
    timeframe: '90 days',
    difficulty: 'beginner',
  },

  // Career
  {
    id: 'career-promotion',
    category: 'career',
    icon: '📈',
    title: 'Get a promotion',
    prompt: 'I want to earn a promotion at my current job within the next 6 months. I need to identify the key skills and visibility needed, build strong relationships with decision-makers, and deliver measurable results in my current role.',
    timeframe: '6 months',
    difficulty: 'advanced',
  },
  {
    id: 'career-new-job',
    category: 'career',
    icon: '💼',
    title: 'Land a new job',
    prompt: 'I want to successfully transition to a new job within 3 months. I need to update my resume and LinkedIn, build my network, prepare for technical and behavioral interviews, and apply to at least 5 positions per week.',
    timeframe: '3 months',
    difficulty: 'intermediate',
  },
  {
    id: 'career-side-project',
    category: 'career',
    icon: '🚀',
    title: 'Build a side project',
    prompt: 'I want to build and launch a side project in the next 3 months — either a web app, mobile app, or SaaS product. I want to go from idea to a working MVP that I can show to users and get real feedback.',
    timeframe: '3 months',
    difficulty: 'intermediate',
  },
  {
    id: 'career-public-speaking',
    category: 'career',
    icon: '🎤',
    title: 'Improve public speaking',
    prompt: 'I want to become a confident public speaker over the next 6 months. My goals include joining Toastmasters or a local club, giving at least 3 presentations, and drastically reducing my anxiety around speaking in front of groups.',
    timeframe: '6 months',
    difficulty: 'intermediate',
  },

  // Learning
  {
    id: 'learning-programming-language',
    category: 'learning',
    icon: '💻',
    title: 'Learn a new programming language',
    prompt: 'I want to become proficient in a new programming language over the next 3 months. I want to go from zero to being able to build real projects, covering syntax, core libraries, and best practices with daily practice sessions.',
    timeframe: '3 months',
    difficulty: 'intermediate',
  },
  {
    id: 'learning-read-12-books',
    category: 'learning',
    icon: '📚',
    title: 'Read 12 books this year',
    prompt: 'I want to read 12 books this year — one per month. I want to set aside 30 minutes of dedicated reading time each day, choose a mix of fiction and non-fiction, and track my progress and key takeaways.',
    timeframe: '12 months',
    difficulty: 'beginner',
  },
  {
    id: 'learning-spanish',
    category: 'learning',
    icon: '🇪🇸',
    title: 'Learn Spanish basics',
    prompt: 'I want to learn basic conversational Spanish over the next 6 months. My goal is to reach an A2 level — able to introduce myself, handle simple transactions, and hold short conversations using apps, online lessons, and speaking practice.',
    timeframe: '6 months',
    difficulty: 'beginner',
  },
  {
    id: 'learning-online-course',
    category: 'learning',
    icon: '🎓',
    title: 'Complete an online course',
    prompt: 'I want to fully complete an online course or certification in a subject relevant to my career or personal interest. I want to finish within 8 weeks by dedicating at least 1 hour per day and completing all assignments and projects.',
    timeframe: '8 weeks',
    difficulty: 'beginner',
  },

  // Finance
  {
    id: 'finance-emergency-fund',
    category: 'finance',
    icon: '🏦',
    title: 'Save $5,000 emergency fund',
    prompt: 'I want to save $5,000 as an emergency fund over the next 10 months. I need to create a budget, identify areas to cut spending, automate monthly transfers to a high-yield savings account, and track my progress weekly.',
    timeframe: '10 months',
    difficulty: 'intermediate',
  },
  {
    id: 'finance-credit-card-debt',
    category: 'finance',
    icon: '💳',
    title: 'Pay off credit card debt',
    prompt: 'I want to pay off all my credit card debt using either the avalanche or snowball method. I need a clear repayment plan, a budget to free up extra cash each month, and strategies to avoid accumulating new debt.',
    timeframe: '12 months',
    difficulty: 'advanced',
  },
  {
    id: 'finance-start-investing',
    category: 'finance',
    icon: '📊',
    title: 'Start investing $200/month',
    prompt: 'I want to start investing $200 per month consistently. I need to open a brokerage or retirement account, understand basic index fund investing, set up automatic contributions, and build the habit of paying myself first.',
    timeframe: '3 months',
    difficulty: 'beginner',
  },
  {
    id: 'finance-monthly-budget',
    category: 'finance',
    icon: '📝',
    title: 'Create a monthly budget',
    prompt: 'I want to create and stick to a monthly budget for the next 3 months. I need to track all income and expenses, categorize spending, identify areas of overspend, set realistic limits, and review my budget weekly.',
    timeframe: '3 months',
    difficulty: 'beginner',
  },

  // Relationships
  {
    id: 'relationships-friendships',
    category: 'relationships',
    icon: '👫',
    title: 'Strengthen my closest friendships',
    prompt: 'I want to deepen my closest friendships over the next 3 months. I will identify 3-5 people I want to invest in, schedule regular catch-ups, be more present and intentional in conversations, and show up consistently for the people I care about.',
    timeframe: '3 months',
    difficulty: 'beginner',
  },
  {
    id: 'relationships-partner-communication',
    category: 'relationships',
    icon: '💑',
    title: 'Improve communication with my partner',
    prompt: 'I want to significantly improve communication with my romantic partner over the next 3 months. This includes learning active listening, reducing reactive arguments, scheduling weekly check-ins, and potentially reading a book or attending couples counseling.',
    timeframe: '3 months',
    difficulty: 'intermediate',
  },
  {
    id: 'relationships-network',
    category: 'relationships',
    icon: '🤝',
    title: 'Build a professional network',
    prompt: 'I want to build a meaningful professional network over the next 6 months. I will attend at least 2 industry events per month, connect with 5 new professionals per week on LinkedIn, schedule 2 coffee chats per month, and be genuinely helpful to others.',
    timeframe: '6 months',
    difficulty: 'intermediate',
  },
  {
    id: 'relationships-family-calls',
    category: 'relationships',
    icon: '📞',
    title: 'Call family weekly',
    prompt: 'I want to establish a habit of calling my family members at least once per week. I will schedule a specific day and time, rotate who I call if I have multiple family members to connect with, and make it a non-negotiable weekly ritual.',
    timeframe: '3 months',
    difficulty: 'beginner',
  },

  // Personal
  {
    id: 'personal-sleep-schedule',
    category: 'personal',
    icon: '😴',
    title: 'Build a consistent sleep schedule',
    prompt: 'I want to build a consistent sleep schedule over the next 6 weeks, going to bed and waking up at the same time every day including weekends. I want to get 7-8 hours of quality sleep and develop a wind-down evening routine.',
    timeframe: '6 weeks',
    difficulty: 'beginner',
  },
  {
    id: 'personal-declutter',
    category: 'personal',
    icon: '🏠',
    title: 'Declutter and organize home',
    prompt: 'I want to declutter and organize my entire home over the next 2 months using a room-by-room approach. I will donate or discard things I no longer need, create proper storage systems, and build habits to maintain the order long-term.',
    timeframe: '2 months',
    difficulty: 'intermediate',
  },
  {
    id: 'personal-journaling',
    category: 'personal',
    icon: '✍️',
    title: 'Start a journaling habit',
    prompt: 'I want to build a consistent daily journaling habit over the next 60 days. I will start with just 5 minutes each morning or evening, use prompts to get started, and use journaling to reflect on my goals, gratitude, and mental wellbeing.',
    timeframe: '60 days',
    difficulty: 'beginner',
  },
  {
    id: 'personal-social-media',
    category: 'personal',
    icon: '📵',
    title: 'Reduce social media usage',
    prompt: 'I want to significantly reduce my social media usage over the next 30 days, cutting my daily screen time in half. I will set app time limits, delete apps from my phone, replace the habit with something intentional, and track my progress daily.',
    timeframe: '30 days',
    difficulty: 'intermediate',
  },
]

export const categoryConfig = {
  health:        { label: 'Health',        icon: '💪', color: '#4ade80' },
  career:        { label: 'Career',        icon: '💼', color: '#60a5fa' },
  learning:      { label: 'Learning',      icon: '🎓', color: '#a78bfa' },
  finance:       { label: 'Finance',       icon: '💰', color: '#34d399' },
  relationships: { label: 'Relationships', icon: '💛', color: '#fb7185' },
  personal:      { label: 'Personal',      icon: '🌱', color: '#fb923c' },
} as const

export type TemplateCategory = keyof typeof categoryConfig
