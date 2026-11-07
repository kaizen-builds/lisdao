# Demo script (about 2 minutes, testnet)

Prerequisites: a Meteor wallet on testnet that is a council member of `lisdao-demo.sputnikv2.testnet`, and the agent running (`agent/run-agent.sh`) so the UI shows "agent online".

1. Open https://lisdao.vercel.app and connect Meteor (wallet-selector popup).
2. Open the Demo DAO; point out the council members and the payout tiers.
3. Create a proposal, e.g. "Donate 0.1 NEAR to the water project". Confirm in Meteor (Sputnik proposal bond applies).
4. Vote **Approve** as a council member; confirm in Meteor. When the threshold is reached Sputnik calls the executor with the escrow.
5. Watch the live feed: the agent opens a browser, goes to the demo charity page, reads the one-time address from `#deposit-address`, and only pays if the vision model's read matches that element exactly. OCR is advisory and does not decide the payee.
6. The agent calls `report_payout`. Within the tier the executor pays and the feed shows "Done" with the transaction link; above the tier it shows the escalated Transfer proposal instead.
7. Open the transaction on testnet.nearblocks.io to show it publicly.

Narration used for the video: see the README "How it works" and "Limitations" sections; say "testnet only".
