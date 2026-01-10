const { getSiteContent } = require('../models/siteContentModel')

class SiteController {
  async getContent(_req, res) {
    const content = await getSiteContent()
    return res.json({
      success: true,
      data: {
        testimonials: content.testimonials,
        howItWorks: content.howItWorks,
        footer: content.footer,
        updatedAt: content.updatedAt
      }
    })
  }
}

module.exports = new SiteController()
