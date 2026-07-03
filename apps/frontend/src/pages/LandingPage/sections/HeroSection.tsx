import styled, { keyframes } from 'styled-components'
import { Button, EnsSVG } from '@ensdomains/thorin'
import { Link } from 'react-router-dom'
import { tokens } from '@/styles/tokens'
import { fadeInUp } from '@/styles/primitives'
import { LiveDot } from '@/components/shared/LiveDot'
import { useGasSponsorshipMinEns } from '@/features/delegate/hooks/useGaslessRelayer'

const RouterLink = styled(Link)`
  text-decoration: none;

  @media (max-width: 767px) {
    width: 100%;
    display: block;

    button {
      width: 100%;
      justify-content: center;
    }
  }
`

const AnchorLink = styled.a`
  text-decoration: none;

  @media (max-width: 767px) {
    width: 100%;
    display: block;

    button {
      width: 100%;
      justify-content: center;
    }
  }
`

function scrollToHowItWorks(e: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById('how-it-works')
  if (!target) return
  e.preventDefault()
  const headerEl = document.querySelector('header')
  const headerHeight = headerEl?.getBoundingClientRect().height ?? 0
  const top =
    target.getBoundingClientRect().top + window.scrollY - headerHeight - 16
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' })
  history.replaceState(null, '', '#how-it-works')
}

const Section = styled.section`
  padding: 60px ${tokens.spacing.xl};
  text-align: center;
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(56, 137, 255, 0.2) 0%, rgba(255, 255, 255, 0.2) 60%),
    ${tokens.color.white};
  border-bottom: 1px solid ${tokens.color.borderLight};

  @media (min-width: 768px) {
    padding: 60px ${tokens.spacing['4xl']};
  }
`

const Content = styled.div`
  position: relative;
  z-index: 1;
  max-width: ${tokens.maxWidth.section};
  margin: 0 auto;
`

const HeroEyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tokens.spacing.xs};
  padding: ${tokens.spacing.xs} ${tokens.spacing.sm};
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid ${tokens.color.white};
  font-size: ${tokens.font.size.base};
  font-weight: ${tokens.font.weight.bold};
  line-height: 20px;
  color: ${tokens.color.darkGray};
  margin-bottom: ${tokens.spacing['2xl']};
  animation: ${fadeInUp} 0.5s ease both;
`

const Headline = styled.h1`
  font-size: 40px;
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.darkBlue};
  line-height: 1.1;
  letter-spacing: -0.02em;
  margin: 0 auto ${tokens.spacing.lg};
  max-width: 860px;
  animation: ${fadeInUp} 0.5s ease 0.1s both;

  @media (min-width: 768px) {
    font-size: 68px;
  }
`

const floatUp = keyframes`
  0%   { transform: translateY(0);      opacity: 0.35; }
  60%  {                                opacity: 0.12; }
  100% { transform: translateY(-110vh); opacity: 0; }
`

const ParticlesLayer = styled.div`
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;

  @media (prefers-reduced-motion: reduce) {
    display: none;
  }
`

const Particle = styled.div<{
  $left: number
  $size: number
  $duration: number
  $delay: number
}>`
  position: absolute;
  bottom: -60px;
  left: ${({ $left }) => $left}%;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  opacity: 0;
  will-change: transform, opacity;
  animation: ${floatUp} ${({ $duration }) => $duration}s ease-in
    ${({ $delay }) => $delay}s infinite;
  pointer-events: auto;
  cursor: pointer;
  transition: filter 0.25s ease;

  svg {
    width: 100%;
    height: 100%;
    color: ${tokens.color.blue};
    transition: transform 0.25s ease;
    transform-origin: center;
  }

  &:hover {
    animation-play-state: paused;
    filter: drop-shadow(0 6px 14px ${tokens.color.lightBlueOpacity});

    svg {
      transform: scale(1.25);
    }
  }
`

const Subtitle = styled.p`
  font-size: ${tokens.font.size.xl};
  line-height: 1.6;
  color: ${tokens.color.darkGray};
  max-width: ${tokens.maxWidth.xl};
  margin: 0 auto ${tokens.spacing['4xl']};
  animation: ${fadeInUp} 0.5s ease 0.2s both;

  @media (min-width: 768px) {
    font-size: ${tokens.font.size['2xl']};
  }
`

const FreeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;
  background: rgba(246, 248, 250, 0.2);
  border: 1px solid rgba(208, 215, 222, 0.2);
  font-size: ${tokens.font.size.xs};
  font-weight: ${tokens.font.weight.bold};
  line-height: 16px;
  color: white;
  margin-left: ${tokens.spacing.sm};
  vertical-align: middle;
`

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${tokens.spacing.md};
  margin: 0 auto ${tokens.spacing['5xl']};
  width: 100%;
  animation: ${fadeInUp} 0.5s ease 0.3s both;

  @media (min-width: 768px) {
    flex-direction: row;
    justify-content: center;
    width: auto;
    align-items: center;
  }
`

const PARTICLE_CONFIGS = [
  { id: 0, left: 4, size: 40, duration: 14, delay: 0 },
  { id: 1, left: 12, size: 24, duration: 12, delay: 5 },
  { id: 2, left: 19, size: 32, duration: 15, delay: 9 },
  { id: 3, left: 26, size: 46, duration: 11, delay: 2 },
  { id: 4, left: 33, size: 28, duration: 13, delay: 7 },
  { id: 5, left: 40, size: 52, duration: 16, delay: 4 },
  { id: 6, left: 47, size: 22, duration: 10, delay: 11 },
  { id: 7, left: 54, size: 38, duration: 14, delay: 1 },
  { id: 8, left: 61, size: 30, duration: 12, delay: 8 },
  { id: 9, left: 68, size: 48, duration: 15, delay: 3 },
  { id: 10, left: 75, size: 26, duration: 11, delay: 6 },
  { id: 11, left: 82, size: 42, duration: 13, delay: 9 },
  { id: 12, left: 89, size: 34, duration: 14, delay: 2 },
  { id: 13, left: 96, size: 28, duration: 10, delay: 7 },
]

export function HeroSection() {
  const gasMinEns = useGasSponsorshipMinEns()
  return (
    <Section>
      <ParticlesLayer aria-hidden>
        {PARTICLE_CONFIGS.map((p) => (
          <Particle
            key={p.id}
            $left={p.left}
            $size={p.size}
            $duration={p.duration}
            $delay={p.delay}
          >
            <EnsSVG />
          </Particle>
        ))}
      </ParticlesLayer>
      <Content>
        <HeroEyebrow>
          <LiveDot tone="success" size={8} />
          ENS Governance · Live program
        </HeroEyebrow>
        <Headline>
          Put your ENS to work <br />
          and earn rewards
        </Headline>
        <Subtitle>
          Help secure ENS governance by delegating to an active voter.
          <br />
          Rewards are automatic, gas is sponsored for wallets holding {gasMinEns}+ ENS.
        </Subtitle>
        <Actions>
          <RouterLink to="/griff">
            <Button colorStyle="bluePrimary">
              Delegate to Griff<FreeBadge>Free</FreeBadge>
            </Button>
          </RouterLink>
          <AnchorLink href="#how-it-works" onClick={scrollToHowItWorks}>
            <Button colorStyle="blueSecondary">See how it works ↓</Button>
          </AnchorLink>
        </Actions>
      </Content>
    </Section>
  )
}
