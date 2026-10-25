import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default {
  packagerConfig: {
    name: 'Athena',
    appBundleId: 'in.athena.assessment',
    asar: true,
    icon: './assets/athena.icns',
    extendInfo: {
      NSCameraUsageDescription:
        'Athena uses your camera for exam monitoring and snapshots during your assessment.',
      NSScreenCaptureUsageDescription:
        'Athena shares your entire display for exam monitoring and snapshots.',
    },
    // Include only runtime code, the built renderer, and production dependencies.
    ignore: (file) => {
      if (!file) return false;
      const root = file.split('/')[1];
      if (!['app', 'backend', 'dist', 'node_modules', 'package.json'].includes(root)) return true;
      if (root === 'app') return !/^\/app(?:\/[^/]+\.js)?$/.test(file);
      if (root === 'backend')
        return !/^\/backend(?:\/(?:[^/]+\.(?:js|json)|data(?:\/questions\.json)?|node_modules(?:\/.*)?))?$/.test(
          file,
        );
      return false;
    },
    osxSign: {
      identity: '-',
      identityValidation: false,
      preAutoEntitlements: false,
      preEmbedProvisioningProfile: false,
      optionsForFile: () => ({ hardenedRuntime: false, timestamp: 'none' }),
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-dmg',
      config: (arch) => ({
        name: `Athena-${version}-darwin-${arch}`,
        title: 'Athena for Apple Silicon',
        icon: './assets/athena.icns',
        format: 'ULFO',
      }),
    },
  ],
};
