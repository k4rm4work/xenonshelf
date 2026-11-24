# Security policy

## Supported versions

Security fixes are made against the current `main` branch and the latest versioned release.
Update to the latest stable image or release before reporting an issue.

## Reporting a vulnerability

Please do not publish exploitable security details in a public issue or discussion.

If private vulnerability reporting is enabled for this repository, use GitHub's
**Report a vulnerability** feature under the repository's Security tab. Otherwise, contact
the maintainer privately through the contact details on their GitHub profile. Include the
affected version, impact, reproduction steps and any suggested mitigation. Please allow
time for investigation and a fix before public disclosure.

## Deployment notes

XenonShelf is intended for a trusted home network. HTTP Basic authentication does not encrypt
traffic. Use a VPN or an HTTPS reverse proxy before exposing the service beyond a trusted LAN.
Keep the Docker image and host operating system up to date, and back up `/data`.
