.PHONY: shoot gif format

# Screenshots of showcase.html in Chromium, Firefox and WebKit (via podman).
# Pass options through ARGS, e.g. make shoot ARGS="--browsers webkit --only tabs --video"
shoot:
	tools/run.sh shoot.mjs $(ARGS)

# Animated tour of the showcase, saved as docs/showcase.gif (via podman).
gif:
	tools/run.sh gif.mjs

format:
	prettier --write '*.html' '*.css' 'tools/*.mjs'
