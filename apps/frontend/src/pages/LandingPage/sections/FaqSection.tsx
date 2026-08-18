import { useId, useState } from 'react'
import styled from 'styled-components'
import { Button, DownChevronSVG, RightArrowSVG } from '@ensdomains/thorin'
import { tokens } from '@/styles/tokens'

/** ClickUp intake form for questions the FAQ doesn't answer. */
const ASK_US_ANYTHING_URL =
  'https://forms.clickup.com/90132341641/f/2ky4wrw9-32333/5X8NDK4X8TI3OTMQ73'

const Section = styled.section`
  background: ${tokens.color.surfaceAlt};
  scroll-margin-top: 96px;
  padding: ${tokens.spacing['3xl']} ${tokens.spacing.xl} ${tokens.spacing['2xl']};

  @media (min-width: 768px) {
    padding: ${tokens.spacing['6xl']} ${tokens.spacing['4xl']} ${tokens.spacing['4xl']};
  }
`

const Inner = styled.div`
  max-width: ${tokens.maxWidth.section};
  margin: 0 auto;
  width: 100%;
`

const Header = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tokens.spacing.md};
  margin: 0 auto ${tokens.spacing['3xl']};
  max-width: 800px;
`

const Eyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${tokens.spacing.xs} ${tokens.spacing.sm};
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid ${tokens.color.borderLight};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  color: ${tokens.color.darkGray};
`

const Heading = styled.h2`
  font-size: ${tokens.font.size['3xl']};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size['5xl']};
  }
`

const Description = styled.p`
  font-size: ${tokens.font.size.lg};
  line-height: 1.5;
  color: ${tokens.color.darkGray};
  margin: 0;
`

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.md};
`

const Card = styled.div`
  background: ${tokens.color.white};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: 16px;
  padding: ${tokens.spacing.xl};
`

const QuestionHeading = styled.h3`
  margin: 0;
`

const QuestionButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${tokens.spacing.lg};
  width: 100%;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: ${tokens.font.size.lg};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  color: ${tokens.color.darkBlue};
  text-align: left;
`

const QuestionText = styled.span`
  flex: 1;
`

const ToggleChip = styled.span<{ $expanded: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 14px;
  background: ${({ $expanded }) =>
    $expanded ? tokens.color.lightBlue : tokens.color.surfaceAlt};
  color: ${({ $expanded }) =>
    $expanded ? tokens.color.blue : tokens.color.darkGray};
  transition: background ${tokens.transition.fast};

  svg {
    width: 12px;
    height: 12px;
    transform: rotate(${({ $expanded }) => ($expanded ? '180deg' : '0deg')});
    transition: transform ${tokens.transition.fast};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    svg {
      transition: none;
    }
  }
`

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.md};
  padding-top: ${tokens.spacing.md};
`

const Answer = styled.p`
  font-size: ${tokens.font.size.base};
  line-height: 20px;
  color: ${tokens.color.darkGray};
  margin: 0;
`

const Footnote = styled.p`
  font-size: ${tokens.font.size.sm};
  line-height: 16px;
  color: ${tokens.color.textSubtle};
  margin: 0;
`

const CtaBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tokens.spacing.md};
  margin-top: ${tokens.spacing['3xl']};
  text-align: center;
`

const CtaTitle = styled.p`
  font-size: 22px;
  font-weight: ${tokens.font.weight.bold};
  line-height: 30px;
  color: ${tokens.color.darkBlue};
  margin: 0;
`

interface FaqEntry {
  question: string
  answer: string
  footnote?: string
}

/**
 * FAQ copy is canonical in Figma ("Home — FAQ", file 9h3HrcD5YgkGe37Hw3vAmm),
 * with the sponsored-gas answer rewritten: this deployment runs without a
 * relayer, so delegators pay their own network fee. Earning has no minimum —
 * any ENS balance qualifies.
 */
function buildFaqEntries(): FaqEntry[] {
  return [
    {
      question: 'What does delegating cost?',
      answer:
        'One Ethereum network fee, the same as any other transaction, usually a couple of dollars. We charge nothing on top and there is no minimum balance to take part. Earning is separate from the fee: you earn with any amount of ENS, as long as you hold some.',
    },
    {
      question: 'Do I keep control of my tokens?',
      answer:
        'Yes. Delegating only assigns your voting power to a delegate, it does not move, lock, or stake your ENS. You stay in full control and can switch delegates or undelegate at any time. Your rewards simply follow your current choice.',
    },
    {
      question: 'How do I earn rewards?',
      answer:
        'Two ways, and you can do either or both. As a token holder, you earn when your ENS is delegated to a delegate who votes. As a delegate, you earn by voting on the round’s proposals. Holders share one reward pool and delegates share another, both paid in ENS at the end of each round.',
    },
    {
      question: 'Am I eligible to earn?',
      answer:
        'If you hold ENS, yes, as long as it is delegated to a delegate who actually votes. ENS that sits undelegated, or is delegated to someone who skips the votes, does not earn. If you are a delegate, you qualify by voting on enough of the round’s proposals. There is no minimum to earn and no sign-up.',
    },
    {
      question: 'Do I need to do anything to earn the most?',
      answer:
        'There is no trick to it. Pick a delegate who votes and stay delegated for the whole round. Rewards are based on your average position over time, not a single snapshot, so undelegating early or moving to an inactive delegate lowers what you earn.',
    },
    {
      question: 'When and how do I get paid?',
      answer:
        'At the end of each round, in ENS, straight to your wallet. If you earned 1 ENS or more, it arrives as a single transfer. If you earned less than 1 ENS, you go into the lottery instead. You never have to claim anything by hand.',
    },
    {
      question: 'What is the lottery?',
      answer:
        'It is how small rewards get paid without being eaten by gas. Everyone who earned under 1 ENS is grouped into shared pools of about 10 ENS. Each pool draws one winner who takes the whole pool, and the bigger your entry, the better your odds. Winners are drawn from Ethereum’s own randomness, so the result cannot be predicted or rigged.',
    },
    {
      question: 'How are rewards calculated?',
      answer:
        'Your share is proportional to your average position during the round. Holders are measured by their average ENS balance, delegates by their average voting power. To keep it fair, no single wallet can take more than its cap of a pool, and anything above the cap is spread across everyone else.',
    },
  ]
}

/**
 * Single FAQ card. Items start collapsed — readers expand the questions they
 * care about — matching the two states of the Figma "FAQ Item" component.
 */
function FaqItem({ entry }: { entry: FaqEntry }) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()

  return (
    <Card>
      <QuestionHeading>
        <QuestionButton
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          <QuestionText>{entry.question}</QuestionText>
          <ToggleChip $expanded={expanded} aria-hidden>
            <DownChevronSVG />
          </ToggleChip>
        </QuestionButton>
      </QuestionHeading>
      {expanded && (
        <Panel id={panelId}>
          <Answer>{entry.answer}</Answer>
          {entry.footnote && <Footnote>{entry.footnote}</Footnote>}
        </Panel>
      )}
    </Card>
  )
}

export function FaqSection() {
  const entries = buildFaqEntries()

  return (
    <Section id="faq" data-testid="faq-section">
      <Inner>
        <Header>
          <Eyebrow>Frequently Asked Questions</Eyebrow>
          <Heading>The basics before you delegate</Heading>
          <Description>Plain answers to what people ask most. No jargon.</Description>
        </Header>

        <List>
          {entries.map((entry) => (
            <FaqItem key={entry.question} entry={entry} />
          ))}
        </List>

        <CtaBlock>
          <CtaTitle>Still have questions?</CtaTitle>
          <Button
            as="a"
            href={ASK_US_ANYTHING_URL}
            target="_blank"
            rel="noopener noreferrer"
            colorStyle="bluePrimary"
            width="fit"
            suffix={<RightArrowSVG width={16} height={16} />}
          >
            Ask us anything
          </Button>
        </CtaBlock>
      </Inner>
    </Section>
  )
}
