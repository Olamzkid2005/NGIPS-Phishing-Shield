from urllib.parse import urlparse


def validate_url(url: str) -> tuple[bool, str]:
    if not url or not url.strip():
        return False, "URL cannot be empty"

    url = url.strip()

    if len(url) > 2048:
        return False, "URL exceeds maximum length of 2048 characters"

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https", ""):
        return False, f"Invalid URL scheme: {parsed.scheme}"

    if not parsed.netloc and not parsed.path:
        return False, "URL has no host or path"

    return True, "Valid URL"
