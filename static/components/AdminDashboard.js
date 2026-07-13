import OverviewStats from "./OverviewStats.js"
import RoutePanel from "./RoutePanel.js"
import StaffPanel from "./StaffPanel.js"
import ClientPanel from "./ClientPanel.js"
import BookingOverview from "./BookingOverview.js"

export default {
    name: "AdminDashboard",
    components: {
        OverviewStats,
        RoutePanel,
        StaffPanel,
        ClientPanel,
        BookingOverview
    },
    data() {
        return {
            activeTab: "overview"
        }
    },
    template: `
        <div>
            <div class="row mb-4">
                <div class="col-md-12">
                    <h2 class="border-bottom pb-2">Admin Administration Panel</h2>
                </div>
            </div>
            <ul class="nav nav-tabs mb-4">
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'overview'}" @click="activeTab = 'overview'">Overview</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'treks'}" @click="activeTab = 'treks'">Trek Routes</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'staff'}" @click="activeTab = 'staff'">Guides & Staff</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'clients'}" @click="activeTab = 'clients'">Clients</button>
                </li>
                <li class="nav-item">
                    <button class="nav-link" :class="{active: activeTab === 'bookings'}" @click="activeTab = 'bookings'">Bookings</button>
                </li>
            </ul>
            <overview-stats v-if="activeTab === 'overview'"></overview-stats>
            <route-panel v-if="activeTab === 'treks'"></route-panel>
            <staff-panel v-if="activeTab === 'staff'"></staff-panel>
            <client-panel v-if="activeTab === 'clients'"></client-panel>
            <booking-overview v-if="activeTab === 'bookings'"></booking-overview>
        </div>
    `
}
