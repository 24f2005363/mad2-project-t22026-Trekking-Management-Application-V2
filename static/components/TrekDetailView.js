export default {
    name: "TrekDetailView",
    props: ["routeId"],
    data() {
        return {
            trek: null,
            loadError: "",
            bookSeats: 1,
            bookMsg: "",
            bookError: ""
        }
    },
    created() {
        this.loadTrek()
    },
    methods: {
        async loadTrek() {
            try {
                let res = await fetch("/api/trekker/treks/" + this.routeId)
                if (res.ok) {
                    this.trek = await res.json()
                    this.bookSeats = 1
                    this.bookMsg = ""
                    this.bookError = ""
                } else {
                    this.loadError = "Trek not found"
                }
            } catch (err) { this.loadError = "Failed to load trek details" }
        },
        async bookNow() {
            this.bookMsg = ""
            this.bookError = ""
            if (!this.bookSeats || this.bookSeats < 1) {
                this.bookError = "Select at least 1 seat"
                return
            }
            try {
                let res = await fetch("/api/trekker/reserve", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ trek_id: this.trek.id, seats: this.bookSeats })
                })
                let result = await res.json()
                if (res.ok) {
                    this.bookMsg = result.message + " (" + result.slots + " seats)"
                    this.trek.left_slots = this.trek.left_slots - this.bookSeats
                } else {
                    this.bookError = result.error || "Booking failed"
                }
            } catch (err) { this.bookError = "Server error" }
        },
        goBack() {
            this.$parent.switchView("explore")
        }
    },
    template: `
        <div v-if="loadError" class="alert alert-danger">{{ loadError }}</div>
        <div v-if="trek">
            <button class="btn btn-outline-secondary btn-sm mb-3" @click="goBack">&larr; Back</button>
            <div class="card p-4 shadow-sm">
                <h3>{{ trek.title }}</h3>
                <p class="text-muted">{{ trek.place }} | {{ trek.level }} | {{ trek.duration }} days</p>
                <p><strong>Dates:</strong> {{ trek.start_date }} to {{ trek.end_date }}</p>
                <p><strong>Available Slots:</strong> {{ trek.left_slots }} / {{ trek.max_slots }}</p>
                <p><strong>About:</strong> {{ trek.about || 'No description' }}</p>
                <div v-if="trek.status == 'Open' && trek.left_slots > 0">
                    <div v-if="bookMsg" class="alert alert-success small">{{ bookMsg }}</div>
                    <div v-if="bookError" class="alert alert-danger small">{{ bookError }}</div>
                    <div class="row g-2 align-items-center">
                        <div class="col-auto">
                            <label class="small">Seats:</label>
                            <input type="number" class="form-control form-control-sm" style="width:80px" v-model.number="bookSeats" min="1" :max="trek.left_slots">
                        </div>
                        <div class="col-auto">
                            <button class="btn btn-primary btn-sm mt-3" @click="bookNow" :disabled="trek.left_slots < 1">Book Now</button>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <span class="text-danger">This trek is not available for booking.</span>
                </div>
            </div>
        </div>
    `
}
