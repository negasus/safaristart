PROJECT := SafariStart/SafariStart.xcodeproj
SCHEME  := SafariStart
BUILD   := build
APP     := $(BUILD)/Build/Products/Release/SafariStart.app

.PHONY: install build clean test serve

# Clean build + relaunch the app so Safari picks up the new extension files.
install: test clean build
	-pkill -x SafariStart
	open "$(APP)"
	@echo "Done. Open a new tab in Safari (close any old SafariStart tabs)."

build:
	xcodebuild -project $(PROJECT) -scheme $(SCHEME) -configuration Release \
		-derivedDataPath $(BUILD) -allowProvisioningUpdates -quiet build

clean:
	rm -rf $(BUILD)

test:
	npm test

serve:
	python3 -m http.server 8765 --directory extension
