import TrekkerHome from "./TrekkerHome.js"
import ExploreView from "./ExploreView.js"
import TrekDetailView from "./TrekDetailView.js"
import TripListView from "./TripListView.js"
import HistoryView from "./HistoryView.js"
import AccountView from "./AccountView.js"

export default {
    name: "TrekkerDashboard",
    components: {
        TrekkerHome,
        ExploreView,
        TrekDetailView,
        TripListView,
        HistoryView,
        AccountView
    },
    data() {
        return {
            viewMode: "home",
            selectedRouteId: null
        }
    },
    methods: {
        switchView(view) {
            this.viewMode = view
            this.selectedRouteId = null
        },
        viewRoute(id) {
            this.selectedRouteId = id
            this.viewMode = "detail"
        }
    },
    template: `
        <div>
            <ul class="nav nav-tabs mb-4">
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='home'}" @click="switchView('home')">Dashboard</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='explore'}" @click="switchView('explore')">Explore</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='trips'}" @click="switchView('trips')">My Trips</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='history'}" @click="switchView('history')">History</button></li>
                <li class="nav-item"><button class="nav-link" :class="{active: viewMode=='account'}" @click="switchView('account')">Account</button></li>
            </ul>
            <trekker-home v-if="viewMode == 'home'"></trekker-home>
            <explore-view v-if="viewMode == 'explore'"></explore-view>
            <trek-detail-view v-if="viewMode == 'detail' && selectedRouteId" :routeId="selectedRouteId"></trek-detail-view>
            <trip-list-view v-if="viewMode == 'trips'"></trip-list-view>
            <history-view v-if="viewMode == 'history'"></history-view>
            <account-view v-if="viewMode == 'account'"></account-view>
        </div>
    `
}
