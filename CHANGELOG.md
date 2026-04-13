# Changelog

All notable changes to the Scrabble Français project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - Security (Phase 1)
- Enhanced password policy (minimum 10 characters with complexity requirements)
- Account lockout mechanism after 5 failed login attempts (30-minute lock)
- Session timeout reduced from 7 days to 2 hours
- Password strength validation function with uppercase, lowercase, digit, and special character requirements
- Login attempt tracking with IP-based lockout
- Session regeneration on successful login

### Added - Testing (Phase 2.1)
- Unit tests for GameLogic class (GameLogicTest.php)
- PHPUnit integration in GitHub Actions workflow
- Integration tests for complete game flows (IntegrationTest.php)
- Security validation tests for password policies and lockout mechanisms

### Added - Accessibility (Phase 2.2)
- ARIA labels on all form inputs and interactive elements
- aria-live regions for dynamic content updates
- Skip links for keyboard navigation
- Enhanced focus indicators with visible outlines
- Improved color contrast for WCAG AA compliance
- Semantic HTML structure improvements

### Added - Performance (Phase 2.3 & 2.4)
- Dictionary caching with APCu to reduce loading time
- Structured logging with rotation (30-day retention)
- Metrics tracking (total requests, errors, API calls, response time)
- Log rotation to prevent disk space issues
- Enhanced monitoring capabilities in Logger class

### Added - Features (Phase 3)
- Word suggestion system based on current rack
- Basic AI player for solo mode (easy/medium/hard difficulties)
- User profile enhancements (bio, avatar, wins/losses tracking)
- Profile update API endpoint
- Game scoring optimization with dedicated calculation method

### Added - Documentation (Phase 3.5)
- Comprehensive API documentation (docs/API.md)
- Security validation report (docs/SECURITY.md)
- Updated README with all new features
- Database schema documentation

### Changed - Deployment (Phase 4.1)
- Migrated deployment from FTP to SSH for improved security
- Updated GitHub Actions workflow for SSH-based deployment
- Added SSH key configuration in deployment workflow
- Removed legacy FTP deployment script

### Changed - UI/UX (Phase 2.3)
- Improved responsive design for mobile devices
- Enhanced board sizing on small screens
- Optimized tile sizes for touch interactions
- Better button sizing for mobile
- Improved game hints visibility on mobile

### Fixed - Bugs (Phase 1)
- Fixed unprofessional error message ("priez" → professional message)
- Fixed inefficient dictionary loading (added caching)
- Fixed potential race conditions in database operations
- Fixed timer desynchronization between client and server
- Fixed weak password policy (added complexity requirements)

### Database Schema Changes
- Added `login_attempts` table for security tracking
- Added `bio` column to users table
- Added `avatar` column to users table
- Added `wins` column to users table
- Added `losses` column to users table

### API Changes
- Added `update_profile` endpoint to auth API
- Added `get_suggestions` endpoint to suggestions API
- Enhanced password validation in register, change_password, and reset_password endpoints
- Added account lockout checks in login endpoint
- Updated all password-related error messages

### Dependencies
- Added PHPUnit for testing
- Added APCu requirement for dictionary caching

### Configuration
- Updated session timeout configuration
- Added password complexity requirements
- Updated .env.example with new SSH deployment variables
- Removed FTP deployment variables from .env.example

### CI/CD
- Added PHPUnit execution in GitHub Actions
- Updated deployment workflow to use SSH instead of FTP
- Added test database setup for automated testing
- Enhanced linting with PHPCS and JSHint

## [1.0.0] - Previous Release

### Added
- Multiplayer Scrabble game
- Timer mode support
- Solo mode
- Automatic scoring
- User authentication
- Game invitations
- Password reset functionality
- Replay system
- Responsive design

### Known Issues
- Message d'erreur non professionnel dans game.php
- Politique de mot de passe faible (8 caractères minimum)
- Pas de verrouillage de compte
- Session timeout trop long (7 jours)
- Chargement dictionnaire inefficace
- Pas de tests unitaires
- Accessibilité limitée
- Responsive mobile non optimisé
- Pas de monitoring
- Pas de suggestions de mots
- Pas d'IA pour mode solo
- Profil utilisateur basique
- Déploiement via FTP (non sécurisé)

---

## Versioning Guidelines

- **Major**: Breaking changes, major new features
- **Minor**: New features, backwards compatible
- **Patch**: Bug fixes, backwards compatible

## Release Process

1. Update version number in relevant files
2. Update CHANGELOG.md with changes
3. Create git tag for release
4. Deploy to production via GitHub Actions
5. Verify deployment success
