.PHONY: shoot format

# Screenshots of showcase.html in Chromium, Firefox and WebKit (via podman).
# Pass options through ARGS, e.g. make shoot ARGS="--browsers webkit --only tabs --video"
shoot:
	tools/shoot.sh $(ARGS)

format:
	prettier --write '*.html' '*.css' 'tools/*.mjs'
