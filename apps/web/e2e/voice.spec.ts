import { expect, test } from "@playwright/test";
import { captureScreenshot, completeOnboarding, openUserSettings, rpc, signup } from "./helpers";

test("bot settings show read aloud and the last summary", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `voice-bot-${stamp}@rakazo.test`, "password12", `Bot ${stamp}`);
  await completeOnboarding(page);
  await page.route("**/rpc/voice/lastSummary", async (route) => {
    await route.fulfill({
      json: { json: { text: "Done. The report is ready. Next is the review." } },
    });
  });
  const bots = await rpc<Array<{ id: string; name: string }>>(page, "bots/list", {});
  const chief = bots.find((bot) => bot.name === "Chief");
  if (!chief) throw new Error("Chief bot was not created");
  await rpc(page, "bots/update", {
    botId: chief.id,
    autoSpeak: true,
    speakMode: "summary",
  });
  await page.reload();
  await page.locator("main").getByRole("button", { name: "Chief", exact: true }).click();
  const settings = page.getByTestId("bot-settings");
  await settings.getByText("Advanced", { exact: true }).click();
  await expect(settings.getByLabel("Last summary")).toHaveValue(
    "Done. The report is ready. Next is the review.",
  );
  await settings.getByLabel("Last summary").scrollIntoViewIfNeeded();
  await captureScreenshot(page, testInfo, "bot-read-aloud");
});

test("voice settings keep the summary model separate from providers", async ({ page }, testInfo) => {
  const stamp = Date.now();
  await signup(page, `voice-summary-${stamp}@rakazo.test`, "password12", `Summary ${stamp}`);
  await completeOnboarding(page);
  await openUserSettings(page, "voice");
  const settings = page.getByTestId("voice-settings");
  await settings.getByRole("button", { name: "Summarise" }).click();
  await expect(settings.getByLabel("Server URL")).toBeVisible();
  await expect(settings.getByLabel("Model")).toBeVisible();
  await expect(settings.getByLabel("API key")).toBeVisible();
  await expect(
    settings.getByText(
      "Used by every voice when a bot reads a summary. Leave blank to use the bot's own model.",
    ),
  ).toBeVisible();
  await captureScreenshot(page, testInfo, "voice-summary");
});

test("voice settings connect a key, speak a reply, and open a call", async ({ page }, testInfo) => {
  const stamp = Date.now();
  const userName = `Voice ${stamp}`;
  await signup(page, `voice-${stamp}@rakazo.test`, "password12", userName);
  await completeOnboarding(page);

  await expect(page.getByRole("button", { name: "Call", exact: true })).toHaveCount(0);
  await expect(
    page.getByTestId("composer-bar").getByRole("button", { name: "Voice", exact: true }),
  ).toHaveCount(1);
  await captureScreenshot(page, testInfo, "voice-composer");
  await page
    .getByTestId("composer-bar")
    .getByRole("button", { name: "Voice", exact: true })
    .click();
  await expect(page.getByTestId("voice-settings")).toBeVisible();
  await expect(page.getByLabel("API key", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dictate", exact: true })).toHaveCount(0);
  await captureScreenshot(page, testInfo, "voice-settings");
  await page.getByRole("button", { name: "Close voice settings" }).click();
  await expect(page.getByTestId("voice-settings")).toHaveCount(0);

  const preparedOff = await rpc<{ ready: boolean }>(page, "voice/prepare", {
    text: "Hello there.",
  });
  expect(preparedOff.ready).toBe(false);

  await openUserSettings(page, "voice");
  await expect(page.getByTestId("voice-settings")).toBeVisible();
  await page.getByRole("button", { name: /Scripted/ }).click();
  const apiKeyInput = page.getByPlaceholder(/Paste your API key/);
  await expect(apiKeyInput).toHaveAttribute("autocomplete", "new-password");
  await apiKeyInput.fill("fake-scripted-voice-key");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(page.getByText("Connected", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Replace key" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
  await captureScreenshot(page, testInfo, "voice-settings-connected");

  const spoken = page.waitForResponse(
    (response) => response.url().includes("/api/voice/speak") && response.ok(),
  );
  await page.getByRole("button", { name: "Hear a sample" }).click();
  const clip = await spoken;
  expect(clip.headers()["content-type"]).toContain("audio/mpeg");

  const credentials = await rpc<Array<{ hasKey: boolean; provider: string }>>(
    page,
    "voice/credentials",
    {},
  );
  expect(credentials).toEqual([expect.objectContaining({ hasKey: true, provider: "scripted" })]);
  expect(JSON.stringify(credentials)).not.toContain("fake-scripted-voice-key");

  await page.getByRole("button", { name: "Close voice settings" }).click();

  const composer = page.getByPlaceholder(/Message/);
  await composer.fill("say hello");
  await page.keyboard.press("Enter");
  // A reply can render more than one text bubble; speak the latest one.
  const speakReply = page.getByRole("button", { name: "Speak this reply" }).last();
  await expect(speakReply).toBeVisible({
    timeout: 30_000,
  });

  const replySpoken = page.waitForResponse(
    (response) => response.url().includes("/api/voice/speak") && response.ok(),
  );
  await speakReply.click();
  await replySpoken;

  await openUserSettings(page, "voice");
  await expect(page.getByRole("button", { name: "Replace key" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close voice settings" }).click();

  await page
    .getByTestId("composer-bar")
    .getByRole("button", { name: "Voice", exact: true })
    .click();
  await expect(page.getByTestId("call-view")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hang up" })).toBeVisible();
  await captureScreenshot(page, testInfo, "voice-call");
  await page.getByRole("button", { name: "Hang up" }).click();
  await expect(page.getByTestId("call-view")).toHaveCount(0);

  await openUserSettings(page, "voice");
  const settings = page.getByTestId("voice-settings");
  await settings.getByPlaceholder(/Paste a replacement key/).fill("leftover-voice-key");
  await settings.getByRole("button", { name: "Disconnect", exact: true }).click();
  await expect(settings.getByRole("button", { name: "Disconnect", exact: true })).toHaveCount(0);
  await expect(settings.getByRole("button", { name: "Connect", exact: true })).toBeVisible();
  await expect(settings.getByLabel("API key", { exact: true })).toHaveValue("");
  await expect(rpc<Array<{ provider: string }>>(page, "voice/credentials", {})).resolves.toEqual(
    [],
  );
});
