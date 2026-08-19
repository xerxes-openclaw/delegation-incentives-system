import { Modal } from '@/components/shared/Modal/Modal'
import { ShareCardBlock } from '@/features/delegate/components/ShareCardBlock'
import { buildVoterShareUrl, buildVoterOgImageUrl } from '@/features/delegate/utils/shareCard'

/**
 * Pre-filled X copy for a delegate sharing their OWN profile (first person).
 * Compliant with ENS Labs messaging rules: no APR / yield / price language;
 * only "rewards from the DAO". The trailing colon leads
 * into the profile URL that X appends after the text.
 */
export const DELEGATE_TWEET_TEXT =
  "I'm an active voter on ENS governance. Delegate your ENS to me to keep the DAO strong. You earn rewards from the DAO for strengthening ENS:"

export interface DelegateShareModalProps {
  open: boolean
  onClose: () => void
  /** The delegate's address (used to build the share URL + card image). */
  address: string
  /** The delegate's ENS name, when resolved (preferred over address in the URL). */
  ensName?: string | null
}

/**
 * First-visit share modal shown to a delegate on their own profile. Mirrors
 * Figma node 6017:5770. The preview image is the exact same endpoint the link
 * unfurl uses, so what the delegate sees here is what their followers see on X.
 */
export function DelegateShareModal({ open, onClose, address, ensName }: DelegateShareModalProps) {
  return (
    <Modal open={open} onClose={onClose} label="Share your delegate profile">
      <ShareCardBlock
        title="Your delegate profile is live"
        body={
          <>
            Share it to bring more ENS into active governance.
            <br />
            Your delegators earn rewards from the DAO.
          </>
        }
        tweetText={DELEGATE_TWEET_TEXT}
        shareUrl={buildVoterShareUrl({ address, ensName })}
        ogImageUrl={buildVoterOgImageUrl({ address, ensName, variant: 'delegate' })}
      />
    </Modal>
  )
}
