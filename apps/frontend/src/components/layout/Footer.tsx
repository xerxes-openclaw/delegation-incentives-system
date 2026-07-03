import { Link } from 'react-router-dom'
import styled from 'styled-components'
import { EnsSVG } from '@ensdomains/thorin'
import { tokens } from '@/styles/tokens'

const StyledFooter = styled.footer`
  background: ${tokens.color.darkBlue};
  color: ${tokens.color.white};
  padding: ${tokens.spacing['4xl']} ${tokens.spacing['2xl']} ${tokens.spacing['2xl']};
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;

  @media (min-width: 768px) {
    padding: ${tokens.spacing['6xl']} ${tokens.spacing['4xl']} ${tokens.spacing['3xl']};
  }
`

const Inner = styled.div`
  max-width: ${tokens.maxWidth.section};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing['4xl']};

  @media (min-width: 768px) {
    gap: ${tokens.spacing['8xl']};
  }
`

const Top = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tokens.spacing['3xl']};

  @media (min-width: 768px) {
    grid-template-columns: minmax(0, 1fr) auto auto;
    gap: ${tokens.spacing['5xl']};
  }
`

const BrandBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.sm};
`

const BrandText = styled.span`
  font-size: ${tokens.font.size.lg};
  font-weight: ${tokens.font.weight.medium};
  color: ${tokens.color.white};
`

const BrandSub = styled.span`
  font-size: ${tokens.font.size.base};
  color: rgba(255, 255, 255, 0.75);
  max-width: 340px;
  line-height: 1.5;
`

const BrandSubLink = styled.a`
  color: ${tokens.color.white};
  text-decoration: none;
  font-weight: ${tokens.font.weight.bold};
  transition: opacity ${tokens.transition.fast};

  &:hover {
    text-decoration: none;
    opacity: 0.7;
  }
`

const NavColumn = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${tokens.spacing.sm};
  min-width: 140px;
`

const ColumnTitle = styled.span`
  font-size: ${tokens.font.size.xs};
  font-weight: ${tokens.font.weight.bold};
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${tokens.color.white};
  margin-bottom: ${tokens.spacing.xs};
`

const FooterLink = styled(Link)`
  font-size: ${tokens.font.size.base};
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  transition: color ${tokens.transition.fast};

  &:hover {
    color: ${tokens.color.white};
  }
`

const ExternalLink = styled.a`
  font-size: ${tokens.font.size.base};
  color: rgba(255, 255, 255, 0.75);
  text-decoration: none;
  transition: color ${tokens.transition.fast};

  &:hover {
    color: ${tokens.color.white};
  }
`

const Bottom = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: ${tokens.spacing.md};
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  padding-top: ${tokens.spacing.xl};
  min-width: 0;
  flex-wrap: wrap;

  @media (min-width: 768px) {
    flex-wrap: nowrap;
    gap: ${tokens.spacing.lg};
  }
`

const FootMark = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  color: ${tokens.color.white};
  line-height: 0;

  svg {
    width: 64px;
    height: 64px;
  }

  svg path,
  svg circle,
  svg rect,
  svg polygon {
    fill: ${tokens.color.white};
  }

  @media (min-width: 768px) {
    svg {
      width: 96px;
      height: 96px;
    }
  }
`

const Wordmark = styled.span`
  font-size: clamp(28px, 9vw, 56px);
  font-weight: ${tokens.font.weight.bold};
  color: ${tokens.color.white};
  line-height: 1;
  letter-spacing: -0.03em;
  min-width: 0;

  @media (min-width: 768px) {
    font-size: clamp(48px, 7vw, 88px);
  }
`

export function Footer() {
  return (
    <StyledFooter>
      <Inner>
        <Top>
          <BrandBlock>
            <BrandText>A community program for safer ENS governance.</BrandText>
            <BrandSub>
              Forked version — built by Xerxes, not by blockful. Forked from{' '}
              <BrandSubLink
                href="https://github.com/blockful/delegation-incentives-system"
                target="_blank"
                rel="noopener noreferrer"
              >
                blockful
              </BrandSubLink>
              {' · '}Powered by{' '}
              <BrandSubLink
                href="https://anticapture.com?utm_source=ens-incentives&utm_medium=footer&utm_campaign=delegation-incentives"
                target="_blank"
                rel="noopener noreferrer"
              >
                Anticapture
              </BrandSubLink>
              .
            </BrandSub>
          </BrandBlock>

          <NavColumn>
            <ColumnTitle>Explore</ColumnTitle>
            <FooterLink to="/">How It Works</FooterLink>
            <FooterLink to="/rounds">Rounds</FooterLink>
            <FooterLink to="/transparency">Transparency</FooterLink>
          </NavColumn>

          <NavColumn>
            <ColumnTitle>Resources</ColumnTitle>
            <ExternalLink
              href="https://discuss.ens.domains"
              target="_blank"
              rel="noopener noreferrer"
            >
              Forum ↗
            </ExternalLink>
            {/* Points at the staging fork; swap to the production repo when that exists. */}
            <ExternalLink
              href="https://github.com/xerxes-openclaw/delegation-incentives-system"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub ↗
            </ExternalLink>
            <ExternalLink
              href="https://forms.clickup.com/90132341641/f/2ky4wrw9-32173/V2SGIA6QAIMSV2KX2Z"
              target="_blank"
              rel="noopener noreferrer"
            >
              Give feedback ↗
            </ExternalLink>
          </NavColumn>
        </Top>

        <Bottom>
          <FootMark aria-hidden>
            <EnsSVG />
          </FootMark>
          <Wordmark>Incentives Program</Wordmark>
        </Bottom>
      </Inner>
    </StyledFooter>
  )
}
