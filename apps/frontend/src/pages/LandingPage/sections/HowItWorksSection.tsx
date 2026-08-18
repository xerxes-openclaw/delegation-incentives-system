import { useEffect, useRef, useState } from 'react'
import styled, { css } from 'styled-components'
import { tokens } from '@/styles/tokens'
import { fadeInUp } from '@/styles/primitives'

const Section = styled.section`
  background: ${tokens.color.surfaceAlt};
  position: relative;
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
  margin: 0 auto ${tokens.spacing['5xl']};
  max-width: 800px;

  @media (min-width: 768px) {
    margin: 0 auto ${tokens.spacing['7xl']};
  }
`

const Eyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tokens.spacing.sm};
  padding: 6px 14px;
  border-radius: ${tokens.radius.pill};
  background: ${tokens.color.status.neutral.bg};
  border: 1px solid ${tokens.color.status.neutral.border};
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.semibold};
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

  @media (min-width: 768px) {
    font-size: ${tokens.font.size.xl};
  }
`

const STEP_OFFSET = 180 // px each next column pushes down on desktop
const STEP_BLOCK_HEIGHT = 200 // approx height of one step's content
const STEPS_COUNT = 4
const STAIRCASE_HEIGHT = (STEPS_COUNT - 1) * STEP_OFFSET + STEP_BLOCK_HEIGHT

const StepsRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.md};

  @media (min-width: 768px) {
    position: relative;
    display: grid;
    grid-template-columns: repeat(${STEPS_COUNT}, 1fr);
    column-gap: 0;
    min-height: ${STAIRCASE_HEIGHT}px;
    gap: 0;
  }
`

const StepCol = styled.div<{
  $index: number
  $animated: boolean
  $visible: boolean
}>`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tokens.spacing.md};
  will-change: transform, opacity;

  /* Mobile: each step is a self-contained card. */
  padding: ${tokens.spacing.xl};
  background: ${tokens.color.white};
  border: 1px solid ${tokens.color.borderLight};
  border-radius: ${tokens.radius.md};

  ${({ $animated, $visible }) =>
    $animated &&
    css`
      opacity: 0;
      ${$visible &&
      css`
        animation: ${fadeInUp} 0.5s ease both;
      `}
    `}

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    opacity: 1;
  }

  @media (min-width: 768px) {
    background: transparent;
    border: none;
    border-radius: 0;
    position: relative;
    padding: ${({ $index }) => $index * STEP_OFFSET}px
      ${tokens.spacing.lg} 0 ${tokens.spacing.lg};

    &:not(:first-child)::before {
      content: '';
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      width: 1px;
      background-image: repeating-linear-gradient(
        to bottom,
        ${tokens.color.darkGray} 0 4px,
        transparent 4px 10px
      );
      -webkit-mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 18%,
        black 82%,
        transparent 100%
      );
      mask-image: linear-gradient(
        to bottom,
        transparent 0%,
        black 18%,
        black 82%,
        transparent 100%
      );
      opacity: 0.2;
    }

    &:first-child {
      padding-left: 0;
    }
  }
`

const NumberBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: ${tokens.color.white};
  border: 1px solid ${tokens.color.borderLight};
  color: ${tokens.color.darkBlue};
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.bold};
  box-shadow: ${tokens.shadow.sm};
`

const StepTitle = styled.h3`
  font-size: ${tokens.font.size.lg};
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  margin: 0;
`

const StepDesc = styled.p`
  font-size: ${tokens.font.size.base};
  line-height: 1.55;
  color: ${tokens.color.darkGray};
  margin: 0;

  @media (min-width: 768px) {
    max-width: 260px;
  }
`

const TagPill = styled.span<{ $bg: string; $color: string }>`
  display: inline-flex;
  border-radius: ${tokens.radius.pill};
  padding: 4px 10px;
  font-size: ${tokens.font.size.sm};
  font-weight: ${tokens.font.weight.semibold};
  background: ${({ $bg }) => $bg};
  color: ${({ $color }) => $color};
`

type Step = {
  number: string
  title: string
  desc: string
  tag: string
  tagBg: string
  tagColor: string
}

function buildSteps(): Step[] {
  return [
    {
      number: '1',
      title: 'Delegate to an active voter',
      desc: 'Pick a delegate who consistently votes on ENS proposals. Delegating assigns voting power only — your tokens stay in your wallet.',
      tag: 'Your tokens never move',
      tagBg: tokens.color.tierHighlight,
      tagColor: tokens.color.positiveEmphasis,
    },
    {
      number: '2',
      title: 'Your share grows with time',
      desc: 'Rewards are based on your average ENS balance over the last 180 days. Longer holding means a bigger share.',
      tag: 'No claiming needed',
      tagBg: tokens.color.lightBlue,
      tagColor: tokens.color.blue,
    },
    {
      number: '3',
      title: 'Receive ENS at round end',
      desc: 'If your share is 1 ENS or more, it’s sent directly to your wallet at the end of each monthly round.',
      tag: 'Paid in ENS, funded by the DAO',
      tagBg: tokens.color.lightOrange,
      tagColor: tokens.color.orange,
    },
    {
      number: '4',
      title: 'Small balance? Enter the lottery',
      desc: 'Payouts under 1 ENS pool together until they reach 10 ENS, and one winner takes the full prize.',
      tag: 'Lottery prize: 10 ENS',
      tagBg: tokens.color.lightOrange,
      tagColor: tokens.color.orange,
    },
  ]
}

function RevealStep({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.4, rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <StepCol ref={ref} $index={index} $animated $visible={visible}>
      {children}
    </StepCol>
  )
}

export function HowItWorksSection() {
  const steps = buildSteps()

  return (
    <Section id="how-it-works">
      <Inner>
          <Header>
            <Eyebrow>How it works</Eyebrow>
            <Heading>
              Simple to join. <br />
              Better when more people do.
            </Heading>
            <Description>
              ENS governance is only as strong as its participation.
              <br />
              This program makes it worth your while.
            </Description>
          </Header>

          <StepsRow>
            {steps.map((step, i) => (
              <RevealStep key={step.number} index={i}>
                <NumberBadge>{step.number}</NumberBadge>
                <StepTitle>{step.title}</StepTitle>
                <StepDesc>{step.desc}</StepDesc>
                <TagPill $bg={step.tagBg} $color={step.tagColor}>
                  {step.tag}
                </TagPill>
              </RevealStep>
            ))}
          </StepsRow>
      </Inner>
    </Section>
  )
}
