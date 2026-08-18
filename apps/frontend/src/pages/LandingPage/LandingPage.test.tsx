import { screen, waitFor } from '@testing-library/react'
import { renderApp, userEvent } from '@/test/utils'
import { LandingPage } from './index'

describe('LandingPage', () => {
  it('renders hero heading when disconnected', async () => {
    renderApp(<LandingPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/Put your ENS to work/),
      ).toBeInTheDocument()
    })
  })

  it('renders tier table with 7 tiers', async () => {
    renderApp(<LandingPage />)
    await waitFor(() => {
      expect(screen.getByTestId('tier-table')).toBeInTheDocument()
    })
    for (let i = 1; i <= 7; i++) {
      expect(screen.getAllByText(`Tier #${i}`).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders how it works section', async () => {
    renderApp(<LandingPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/Simple to join/),
      ).toBeInTheDocument()
    })
  })

  it('renders CTA section', async () => {
    renderApp(<LandingPage />)
    await waitFor(() => {
      expect(
        screen.getByText(/Earn ENS rewards/),
      ).toBeInTheDocument()
    })
  })

  it('renders FAQ section with all 8 questions, collapsed by default', async () => {
    renderApp(<LandingPage />)
    await waitFor(() => {
      expect(screen.getByTestId('faq-section')).toBeInTheDocument()
    })

    const questions = [
      'What does delegating cost?',
      'Do I keep control of my tokens?',
      'How do I earn rewards?',
      'Am I eligible to earn?',
      'Do I need to do anything to earn the most?',
      'When and how do I get paid?',
      'What is the lottery?',
      'How are rewards calculated?',
    ]
    for (const question of questions) {
      expect(
        screen.getByRole('button', { name: question }),
      ).toHaveAttribute('aria-expanded', 'false')
    }
    // Answers stay out of the DOM until a question is expanded (collapsed accordion).
    expect(
      screen.queryByText(/Delegating only assigns your voting power/),
    ).not.toBeInTheDocument()
  })

  it('FAQ cost answer states the user pays the network fee, once expanded', async () => {
    // Items start collapsed, so expand the cost question before asserting.
    // This deployment runs without a relayer, so the answer must not promise
    // sponsored gas or gate participation on a minimum balance.
    renderApp(<LandingPage />)
    const question = await screen.findByRole('button', {
      name: 'What does delegating cost?',
    })
    await userEvent.click(question)
    await waitFor(() => {
      expect(
        screen.getByText(/One Ethereum network fee/),
      ).toBeInTheDocument()
    })
    expect(screen.queryByText(/gas is sponsored/i)).not.toBeInTheDocument()
  })

  it('FAQ expands an item when its question is clicked', async () => {
    renderApp(<LandingPage />)
    const question = await screen.findByRole('button', {
      name: 'Do I keep control of my tokens?',
    })
    // Collapsed by default → the answer is not rendered yet.
    expect(question).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByText(/Delegating only assigns your voting power/),
    ).not.toBeInTheDocument()

    await userEvent.click(question)

    expect(question).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByText(/Delegating only assigns your voting power/),
    ).toBeInTheDocument()
  })

  it('renders Ask us anything button linking to the ClickUp form', async () => {
    renderApp(<LandingPage />)
    await waitFor(() => {
      expect(screen.getByText(/Still have questions/)).toBeInTheDocument()
    })
    const link = screen.getByRole('link', { name: /Ask us anything/ })
    expect(link).toHaveAttribute(
      'href',
      'https://forms.clickup.com/90132341641/f/2ky4wrw9-32333/5X8NDK4X8TI3OTMQ73',
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders landing when wallet is connected', async () => {
    renderApp(<LandingPage />, {
      walletState: { status: 'connected', address: '0x1234567890abcdef1234567890abcdef12345678' },
    })
    await waitFor(() => {
      expect(
        screen.getByText(/Put your ENS to work/),
      ).toBeInTheDocument()
    })
  })

  it('renders landing when wallet is delegated', async () => {
    renderApp(<LandingPage />, {
      walletState: {
        status: 'delegated',
        address: '0x1234567890abcdef1234567890abcdef12345678',
        delegatedTo: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      },
    })
    await waitFor(() => {
      expect(
        screen.getByText(/Put your ENS to work/),
      ).toBeInTheDocument()
    })
  })
})
