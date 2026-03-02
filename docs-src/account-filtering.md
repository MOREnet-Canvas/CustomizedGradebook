# Account Filtering

Account filtering allows you to control which Canvas sub-accounts have access to Customized Gradebook features.

## Overview

Even though the CG theme must be installed at the root account level, you can restrict which sub-accounts actually use CG features.

## Use Cases

- **Pilot programs** - Enable CG for specific schools or departments
- **Gradual rollout** - Add sub-accounts incrementally
- **Testing** - Test in specific sub-accounts before full deployment

## Configuration

### Enable Account Filtering

1. Access the Admin Dashboard
2. Navigate to Account Filtering settings
3. Select sub-accounts to enable
4. Save configuration

### Disable Account Filtering

To allow all sub-accounts:

1. Access the Admin Dashboard
2. Disable account filtering
3. CG features will be available to all sub-accounts

## How It Works

When account filtering is enabled:

- CG checks the current account context
- If the account is in the allowed list, features are enabled
- If not, CG features are hidden/disabled

## Best Practices

- **Start small** - Enable for one sub-account first
- **Test thoroughly** - Verify features work as expected
- **Communicate** - Inform users when enabling new sub-accounts
- **Monitor** - Watch for issues after enabling new accounts

## Next Steps

- [Admin Dashboard](admin-dashboard.md) - Return to dashboard overview
- [Mobile Module](mobile/overview.md) - Set up mobile features