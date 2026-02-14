# Love Life Debugger - Product Requirements Document

## Original Problem Statement
Convert a "Love Life Debugger — Personality Quiz" single HTML file into a SaaS application with freemium model. Users take a 25-question quiz about attachment styles, conflict patterns, and relationship behaviors, then receive scored results.

## User Personas
1. **Self-improvement Seekers**: Adults wanting to understand their relationship patterns
2. **Relationship Curious**: People interested in attachment theory and love psychology
3. **Therapy-Adjacent Users**: Those exploring self-reflection tools alongside or instead of therapy

## Core Requirements (Static)
- 25 questions across 3 sections: Attachment, Conflict, Patterns
- 4 scoring dimensions: AX (Anxious), AV (Avoidant), CR (Conflict Risk), PS (Pattern Score)
- Freemium model: Free teaser vs Paid full results ($10)
- Stripe payment integration
- Sharing options: Copy (free), Twitter/Facebook/Email (paid)
- Love-themed dark design (pink, red, white, black)

## What's Been Implemented (Jan 2026)
### Backend (FastAPI)
- [x] Quiz questions API (`GET /api/quiz/questions`)
- [x] Quiz submission with scoring (`POST /api/quiz/submit`)
- [x] Results retrieval (`GET /api/results/{result_id}`)
- [x] Stripe checkout integration (`POST /api/checkout/session`)
- [x] Payment status polling (`GET /api/checkout/status/{session_id}`)
- [x] Stripe webhook handler (`POST /api/webhook/stripe`)
- [x] Email results endpoint (`POST /api/results/email`)
- [x] MongoDB storage for results and transactions

### Frontend (React)
- [x] Quiz page with all 25 questions
- [x] Progress bar and question counter
- [x] 5-point scale interaction
- [x] Results page with teaser/full display
- [x] Stripe checkout redirect
- [x] Payment status polling
- [x] Copy to clipboard (free)
- [x] Social sharing buttons (paid)
- [x] Email results input (paid)
- [x] Love-themed dark design with Playfair Display + Manrope fonts

### Integrations
- [x] Stripe checkout via emergentintegrations library
- [x] MongoDB for data persistence

## Prioritized Backlog

### P0 (Critical) - Complete
- [x] Core quiz functionality
- [x] Payment flow
- [x] Results display

### P1 (High Priority)
- [ ] Real email delivery integration (SendGrid/Resend)
- [ ] User accounts for result history
- [ ] Analytics dashboard for quiz completion rates

### P2 (Medium Priority)
- [ ] Multiple quiz types/versions
- [ ] Partner comparison feature
- [ ] Detailed PDF report generation
- [ ] Coupon/discount codes

### P3 (Nice to Have)
- [ ] Quiz translations (i18n)
- [ ] Mobile app version
- [ ] Integration with relationship coaches

## Next Tasks
1. Integrate actual email service for emailing results
2. Add user authentication for saving multiple quiz results
3. Create admin analytics dashboard
4. A/B test pricing ($10 vs $15 vs $7)
