const { mongoose } = require('../config/mongoose')

const siteContentSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, default: 'main' },
  testimonials: [
    {
      name: String,
      role: String,
      quote: String,
      initials: String,
      colorClass: String
    }
  ],
  howItWorks: [
    {
      title: String,
      description: String,
      icon: { type: String, default: 'target' }
    }
  ],
  footer: {
    brand: {
      title: { type: String, default: 'EcoTrack' },
      description: { type: String, default: '' }
    },
    resourceLinks: [
      { label: String, path: String }
    ],
    legalLinks: [
      { label: String, path: String }
    ],
    contact: {
      address: String,
      phone: String,
      email: String
    },
    socialLinks: [
      { label: String, href: String, icon: String }
    ],
    newsletter: {
      title: { type: String, default: 'Stay Updated' },
      subtitle: { type: String, default: 'Get monthly sustainability tips and community updates directly.' }
    },
    credits: {
      author: { type: String, default: 'Omar Faruk' },
      authorUrl: { type: String, default: 'https://github.com/iamOmarFaruk' }
    }
  },
  updatedBy: { type: String, default: null },
  updatedAt: { type: Date, default: Date.now }
}, { minimize: false })

const SiteContent = mongoose.models.SiteContent || mongoose.model('SiteContent', siteContentSchema)

// Color palette for auto-assignment
const colorPalette = [
  'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300',
  'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300',
  'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-300',
  'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300',
]

const getColorClass = (index) => colorPalette[index % colorPalette.length]

const defaultContent = {
  key: 'main',
  testimonials: [
    {
      name: 'Sarah Jenkins',
      role: 'Eco Enthusiast',
      quote: 'EcoTrack has completely transformed how I view my daily impact. The challenges are fun and the community is incredibly supportive!',
      initials: 'SJ',
      colorClass: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
    },
    {
      name: 'Michael Chen',
      role: 'Sustainability Lead',
      quote: 'As a professional in the field, I love how data-driven this platform is. It makes tracking carbon footprint reductions tangible and accurate.',
      initials: 'MC',
      colorClass: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-300'
    },
    {
      name: 'Emma Rodriguez',
      role: 'Student',
      quote: "I started using this for a class project and couldn't stop. It's addictive in the best way possible. Five stars!",
      initials: 'ER',
      colorClass: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
    },
    {
      name: 'David Kim',
      role: 'Urban Gardener',
      quote: 'The specific tips for urban living have helped me reduce waste significantly. Highly recommend for city dwellers.',
      initials: 'DK',
      colorClass: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-300'
    },
    {
      name: 'Jessica Alba',
      role: 'Homeowner',
      quote: "Finally, an app that doesn't just preach but gives practical steps. My energy bills are down 15% since following the tips.",
      initials: 'JA',
      colorClass: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300'
    }
  ],
  howItWorks: [
    {
      title: 'Join a Challenge',
      description: 'Browse through our diverse collection of eco-friendly challenges and pick ones that match your lifestyle and goals.',
      icon: 'target'
    },
    {
      title: 'Track Progress',
      description: 'Monitor your daily activities, log your achievements, and watch your environmental impact grow with detailed analytics.',
      icon: 'trending-up'
    },
    {
      title: 'Share Tips',
      description: 'Connect with our community by sharing your experiences, tips, and inspiring others on their sustainability journey.',
      icon: 'chat'
    }
  ],
  footer: {
    brand: {
      title: 'EcoTrack',
      description: 'Empowering individuals to track their environmental impact and build a sustainable future through community-driven action.'
    },
    resourceLinks: [
      { label: 'About Us', path: '/about' },
      { label: 'Contact', path: '/contact' },
      { label: 'FAQ', path: '/faq' },
      { label: 'Sustainability Guide', path: '/guide' }
    ],
    legalLinks: [
      { label: 'Privacy Policy', path: '/privacy' },
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Cookie Policy', path: '/cookies' }
    ],
    contact: {
      address: 'Green District, Eco Avenue 42, Earth',
      phone: '+1 (555) ECO-TRACK',
      email: 'hello@ecotrack.com'
    },
    socialLinks: [
      { label: 'GitHub', href: 'https://github.com/iamOmarFaruk', icon: 'github' },
      { label: 'X', href: 'https://x.com', icon: 'x' },
      { label: 'Instagram', href: 'https://instagram.com', icon: 'instagram' },
      { label: 'LinkedIn', href: 'https://linkedin.com', icon: 'linkedin' }
    ],
    newsletter: {
      title: 'Stay Updated',
      subtitle: 'Get monthly sustainability tips and community updates directly.'
    },
    credits: {
      author: 'Omar Faruk',
      authorUrl: 'https://github.com/iamOmarFaruk'
    }
  }
}

function normalizeContent(content) {
  if (!content) return defaultContent

  // Auto-assign colorClass based on position if not provided
  const testimonials = content.testimonials?.length
    ? content.testimonials.map((t, i) => ({
        ...t,
        colorClass: t.colorClass || getColorClass(i)
      }))
    : defaultContent.testimonials

  return {
    ...defaultContent,
    ...content,
    testimonials,
    howItWorks: content.howItWorks?.length ? content.howItWorks : defaultContent.howItWorks,
    footer: {
      ...defaultContent.footer,
      ...content.footer,
      resourceLinks: content.footer?.resourceLinks?.length ? content.footer.resourceLinks : defaultContent.footer.resourceLinks,
      legalLinks: content.footer?.legalLinks?.length ? content.footer.legalLinks : defaultContent.footer.legalLinks,
      contact: {
        ...defaultContent.footer.contact,
        ...content.footer?.contact
      },
      socialLinks: content.footer?.socialLinks?.length ? content.footer.socialLinks : defaultContent.footer.socialLinks,
      newsletter: {
        ...defaultContent.footer.newsletter,
        ...content.footer?.newsletter
      },
      credits: {
        ...defaultContent.footer.credits,
        ...content.footer?.credits
      }
    }
  }
}

async function getSiteContent() {
  let content = await SiteContent.findOne({ key: 'main' }).lean()
  if (!content) {
    const created = await SiteContent.create(defaultContent)
    content = created.toObject()
  }
  return normalizeContent(content)
}

async function updateSiteContent(payload = {}, updatedBy = null) {
  const update = {
    ...payload,
    updatedBy,
    updatedAt: new Date()
  }

  const result = await SiteContent.findOneAndUpdate(
    { key: 'main' },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean()

  return normalizeContent(result)
}

module.exports = {
  SiteContent,
  defaultContent,
  getSiteContent,
  updateSiteContent
}
