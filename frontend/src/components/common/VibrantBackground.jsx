import { Box } from '@mui/material';
import topVibrant from 'assets/images/sections/topbar-vibrant.webp';
import sidebarVibrant from 'assets/images/sections/sidebar-vibrant.webp';

const VibrantBackground = ({ position }) => {
  return (
    <Box
      sx={[
        {
          backgroundPosition: 'left top',
          top: 0,
          position: 'absolute',
          height: '100%',
          width: '100%',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            bgcolor: 'background.default',
            opacity: 0.8,
          },
        },
        position === 'top' && {
          backgroundImage: `url(${topVibrant})`,
        },
        position === 'side' && {
          backgroundImage: `url(${sidebarVibrant})`,
        },
      ]}
    />
  );
};

export default VibrantBackground;
