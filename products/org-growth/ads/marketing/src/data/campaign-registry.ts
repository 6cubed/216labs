/**
 * Central catalog of marketing campaigns across 216Labs apps.
 *
 * Convention: a **dedicated blog** for an app is one campaign row with kind
 * `dedicated_blog`, `parentAppId` = the product app (e.g. onefit), and the
 * blog usually ships as its own deployable app (e.g. onefitblog → onefit).
 * Add new rows here when you add a new app blog or other channel.
 */

export const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? '6cubed.app'

export function appUrl(appId: string): string {
  return `https://${appId}.${APP_HOST}`
}

export type CampaignKind =
  | 'dedicated_blog'
  | 'newsletter'
  | 'social'
  | 'paid_ads'
  | 'landing'
  | 'community'
  | 'other'

export type CampaignStatus = 'live' | 'planned' | 'paused'

export interface Campaign {
  id: string
  /** Manifest id of the product / parent app this campaign promotes */
  parentAppId: string
  parentAppName: string
  kind: CampaignKind
  name: string
  description: string
  /** Public URL when live */
  url: string | null
  status: CampaignStatus
  notes?: string
}

export const campaigns: Campaign[] = [
  {
    id: '216labs-blog',
    parentAppId: 'landing',
    parentAppName: '216labs (factory)',
    kind: 'dedicated_blog',
    name: '216labs Blog',
    description:
      'Essays and updates for the vibe-coding ecosystem — hosting, Activator, security, and roadmap.',
    url: appUrl('blog'),
    status: 'live',
    notes: 'Umbrella editorial; not tied to a single product app.',
  },
  {
    id: 'onefit-fashion-journal',
    parentAppId: 'onefit',
    parentAppName: 'OneFit',
    kind: 'dedicated_blog',
    name: 'OneFit Fashion Journal',
    description:
      'Fashion tips and colour theory with illustrated looks; organic funnel into the OneFit AI stylist.',
    url: appUrl('onefitblog'),
    status: 'live',
    notes: 'Dedicated deployable at onefitblog; affiliated_app_id onefit in manifest.',
  },
  {
    id: 'pocket-newsletter',
    parentAppId: 'pocket',
    parentAppName: 'Pocket',
    kind: 'newsletter',
    name: 'Product updates list',
    description: 'Planned low-volume list for Pocket Cursor bridge releases.',
    url: null,
    status: 'planned',
  },
  {
    id: '1pageresearch-landing',
    parentAppId: '1pageresearch',
    parentAppName: '1PageResearch',
    kind: 'landing',
    name: 'Conversion landing',
    description: 'Primary landing and Stripe paywall for one-page research reports.',
    url: appUrl('1pageresearch'),
    status: 'live',
  },
]

export function campaignsByParentApp(): Map<string, Campaign[]> {
  const m = new Map<string, Campaign[]>()
  for (const c of campaigns) {
    const list = m.get(c.parentAppId) ?? []
    list.push(c)
    m.set(c.parentAppId, list)
  }
  return m
}

export function kindLabel(kind: CampaignKind): string {
  const labels: Record<CampaignKind, string> = {
    dedicated_blog: 'Dedicated blog',
    newsletter: 'Newsletter',
    social: 'Social',
    paid_ads: 'Paid ads',
    landing: 'Landing / funnel',
    community: 'Community',
    other: 'Other',
  }
  return labels[kind]
}
