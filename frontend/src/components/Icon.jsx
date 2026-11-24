import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon,
  ChampionIcon,
  UserGroupIcon,
  Search01Icon,
  Calendar03Icon,
  Settings01Icon,
  Tick02Icon,
  Alert02Icon,
  Location01Icon,
  ArrowUpRight01Icon
} from '@hugeicons/core-free-icons';
const icons = {
  home: Home01Icon,
  trophy: ChampionIcon,
  users: UserGroupIcon,
  search: Search01Icon,
  calendar: Calendar03Icon,
  settings: Settings01Icon,
  check: Tick02Icon,
  alert: Alert02Icon,
  location: Location01Icon,
  arrow: ArrowUpRight01Icon
};
const Icon = ({ name, size = 18 }) => (
  <HugeiconsIcon
    icon={icons[name]}
    size={size}
    strokeWidth={1.5}
    aria-hidden="true"
    className="ui-icon"
  />
);
export default Icon;
