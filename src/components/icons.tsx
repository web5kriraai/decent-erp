import type { LucideIcon, LucideProps } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  BarChart3,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Clock3,
  Copy,
  Eye,
  Factory,
  File,
  FileBarChart,
  FileText,
  FolderOpen,
  Gavel,
  Handshake,
  Home,
  IndianRupee,
  Info,
  LayoutDashboard,
  Layers,
  ListTodo,
  ListTree,
  Loader2,
  Lock,
  LogOut,
  Menu,
  Package,
  Pause,
  PauseCircle,
  Pencil,
  Play,
  PlayCircle,
  Plus,
  Power,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  Send,
  Settings2,
  Shield,
  ShieldAlert,
  SkipForward,
  Square,
  Timer,
  Trash2,
  UploadCloud,
  UserRound,
  Users,
  Workflow,
  X,
  XCircle,
} from "lucide-react";

export type IconProps = Omit<LucideProps, "ref"> & {
  size?: number | string;
};

/**
 * Single icon surface for Decent ERP - Lucide only, shared stroke/size defaults.
 * Import icons from here; do not import from `lucide-react` in feature/UI code.
 */
function createIcon(Lucide: LucideIcon, displayName: string) {
  function WrappedIcon({ size = 20, strokeWidth = 1.75, absoluteStrokeWidth, ...props }: IconProps) {
    return (
      <Lucide
        size={size}
        strokeWidth={strokeWidth}
        absoluteStrokeWidth={absoluteStrokeWidth ?? true}
        aria-hidden
        {...props}
      />
    );
  }
  WrappedIcon.displayName = displayName;
  return WrappedIcon;
}

// -- Navigation / brand actions --
export const IconDashboard = createIcon(LayoutDashboard, "IconDashboard");
export const IconDesigns = createIcon(Boxes, "IconDesigns");
export const IconTasks = createIcon(ListTodo, "IconTasks");
export const IconCorrections = createIcon(AlertTriangle, "IconCorrections");
export const IconApprovals = createIcon(ClipboardCheck, "IconApprovals");
export const IconCosting = createIcon(IndianRupee, "IconCosting");
export const IconKpi = createIcon(BarChart3, "IconKpi");
export const IconMasters = createIcon(Settings2, "IconMasters");
export const IconSearch = createIcon(Search, "IconSearch");
export const IconPlus = createIcon(Plus, "IconPlus");
export const IconLogout = createIcon(LogOut, "IconLogout");
export const IconEmpty = createIcon(FileText, "IconEmpty");
export const IconLock = createIcon(Lock, "IconLock");
export const IconCheck = createIcon(Check, "IconCheck");
export const IconClock = createIcon(Clock, "IconClock");
export const IconTeamTime = createIcon(Timer, "IconTeamTime");
export const IconTimeReport = createIcon(ClipboardList, "IconTimeReport");
export const IconUsers = createIcon(Users, "IconUsers");
export const IconRoles = createIcon(Shield, "IconRoles");
export const IconWorkflow = createIcon(Workflow, "IconWorkflow");
export const IconProduction = createIcon(Factory, "IconProduction");
export const IconErpChain = createIcon(Layers, "IconErpChain");
export const IconReports = createIcon(FileBarChart, "IconReports");
export const IconAudit = createIcon(ScrollText, "IconAudit");
export const IconChevronLeft = createIcon(ChevronLeft, "IconChevronLeft");
export const IconChevronRight = createIcon(ChevronRight, "IconChevronRight");
export const IconChevronDown = createIcon(ChevronDown, "IconChevronDown");
export const IconChevronUp = createIcon(ChevronUp, "IconChevronUp");
export const IconMenu = createIcon(Menu, "IconMenu");
export const IconClose = createIcon(X, "IconClose");

// -- Feedback / status --
export const IconAlertTriangle = createIcon(AlertTriangle, "IconAlertTriangle");
export const IconAlertCircle = createIcon(AlertCircle, "IconAlertCircle");
export const IconCheckCircle2 = createIcon(CheckCircle2, "IconCheckCircle2");
export const IconXCircle = createIcon(XCircle, "IconXCircle");
export const IconInfo = createIcon(Info, "IconInfo");
export const IconCircleDashed = createIcon(CircleDashed, "IconCircleDashed");
export const IconClock3 = createIcon(Clock3, "IconClock3");
export const IconPauseCircle = createIcon(PauseCircle, "IconPauseCircle");
export const IconPlayCircle = createIcon(PlayCircle, "IconPlayCircle");
export const IconSkipForward = createIcon(SkipForward, "IconSkipForward");
export const IconRotateCcw = createIcon(RotateCcw, "IconRotateCcw");
export const IconLoader2 = createIcon(Loader2, "IconLoader2");

// -- Actions / table --
export const IconTrash2 = createIcon(Trash2, "IconTrash2");
export const IconPencil = createIcon(Pencil, "IconPencil");
export const IconCopy = createIcon(Copy, "IconCopy");
export const IconBan = createIcon(Ban, "IconBan");
export const IconPower = createIcon(Power, "IconPower");
export const IconSend = createIcon(Send, "IconSend");
export const IconListTree = createIcon(ListTree, "IconListTree");
export const IconEye = createIcon(Eye, "IconEye");
export const IconRefreshCw = createIcon(RefreshCw, "IconRefreshCw");

// -- Media / files --
export const IconFile = createIcon(File, "IconFile");
export const IconFileText = createIcon(FileText, "IconFileText");
export const IconUploadCloud = createIcon(UploadCloud, "IconUploadCloud");
export const IconFolderOpen = createIcon(FolderOpen, "IconFolderOpen");
export const IconPackage = createIcon(Package, "IconPackage");

// -- People / domain --
export const IconUserRound = createIcon(UserRound, "IconUserRound");
export const IconBell = createIcon(Bell, "IconBell");
export const IconHome = createIcon(Home, "IconHome");
export const IconHandshake = createIcon(Handshake, "IconHandshake");
export const IconGavel = createIcon(Gavel, "IconGavel");
export const IconShieldAlert = createIcon(ShieldAlert, "IconShieldAlert");
export const IconClipboardList = createIcon(ClipboardList, "IconClipboardList");
export const IconClipboardCheck = createIcon(ClipboardCheck, "IconClipboardCheck");
export const IconIndianRupee = createIcon(IndianRupee, "IconIndianRupee");

// -- Timer controls --
export const IconPlay = createIcon(Play, "IconPlay");
export const IconPause = createIcon(Pause, "IconPause");
export const IconSquare = createIcon(Square, "IconSquare");
