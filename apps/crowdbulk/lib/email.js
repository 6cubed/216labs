const nodemailer = require('nodemailer')

function getTransport() {
  const url = process.env.CROWDBULK_SMTP_URL
  if (!url) return null
  try {
    return nodemailer.createTransport(url)
  } catch {
    return null
  }
}

async function sendJobComplete(toEmail, jobId, baseUrl) {
  const transport = getTransport()
  const from = process.env.CROWDBULK_FROM_EMAIL || 'noreply@6cubed.app'
  const resultsUrl = baseUrl ? `${baseUrl}/api/jobs/${jobId}/results` : null
  const text = resultsUrl
    ? `Your CrowdBulk job ${jobId} is complete. Download results: ${resultsUrl}`
    : `Your CrowdBulk job ${jobId} is complete.`
  if (!transport) {
    console.log('[CrowdBulk] Would send email to', toEmail, ':', text)
    return
  }
  try {
    await transport.sendMail({
      from,
      to: toEmail,
      subject: `CrowdBulk job ${jobId} complete`,
      text,
    })
  } catch (err) {
    console.error('[CrowdBulk] Email failed:', err.message)
  }
}

module.exports = { sendJobComplete }
