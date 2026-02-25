# "Conversation info (untrusted metadata)" Investigation

## Issue
J is seeing these blocks in chat messages:
```
Conversation info (untrusted metadata):
{
  "message_id": "c809c255-fd47-4f15-8b74-c1c20751862d",
  "sender": "openclaw-control-ui"
}
```

## Root Cause Analysis

### OpenClaw Security Update
This is **intentional security behavior** from OpenClaw's recent security updates. From the changelog:

- **Security**: "keep untrusted channel metadata out of system prompts (Slack/Discord)"
- **Webchat/Prompts**: "stop injecting direct-chat `conversation_label` into inbound untrusted metadata context blocks, preventing internal label noise from leaking into visible chat replies"
- **Security/Web tools**: "treat browser/web content as untrusted by default (wrapped outputs... and structured external-content metadata for web tools)"

### Purpose
1. **Prevent Prompt Injection**: Mark metadata as "untrusted" so AI doesn't treat it as user input
2. **Security Hardening**: Clear separation between user content and system metadata  
3. **Transparency**: Show AI systems what metadata they're receiving

## Current Status
- **Not a bug**: This is working as designed for security
- **Possible Display Issue**: May be showing more visibly in webchat than intended
- **Configuration Option**: Need to check if there's a way to minimize/hide display

## Investigation Tasks
1. Check OpenClaw config for metadata display controls
2. Look for webchat-specific settings to reduce verbosity
3. Verify security features still work if display is minimized
4. Test with different channels (webchat vs others)

## Potential Solutions
1. **Config Option**: Find setting to hide metadata display while keeping security
2. **CSS/UI Fix**: Style the metadata blocks to be less intrusive  
3. **Channel Setting**: Configure webchat to minimize metadata display
4. **Accept As-Is**: Keep security-first approach with visible metadata

## Next Steps
- Claudee investigating configuration options during night deployment
- Test different display settings
- Document final solution for future reference