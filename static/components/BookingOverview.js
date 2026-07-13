export default {
    name: "BookingOverview",
    data() {
        return {
            bookings: []
        }
    },
    created() {
        this.loadBookings()
    },
    methods: {
        async loadBookings() {
            try {
                const res = await fetch("/api/adm-bookings/all")
                if (res.ok) this.bookings = await res.json()
            } catch (err) { console.log("Bookings load error") }
        }
    },
    template: `
        <div class="card p-3 shadow-sm table-responsive">
            <h5>All Bookings List</h5>
            <div class="mb-2 mt-2">
                <button class="btn btn-outline-primary btn-sm" @click="loadBookings">Refresh</button>
            </div>
            <table class="table table-hover mt-3 align-middle">
                <thead>
                    <tr>
                        <th>Trek Route</th>
                        <th>Client Name</th>
                        <th>Seats Booked</th>
                        <th>Booking Time</th>
                        <th>Status</th>
                        <th>Payment</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="b in bookings" :key="b.id">
                        <td><strong>{{ b.trek_title }}</strong></td>
                        <td>{{ b.client_name }}</td>
                        <td>{{ b.qty }}</td>
                        <td>{{ b.book_time }}</td>
                        <td>
                            <span class="badge" :class="{'bg-success': b.status === 'Booked', 'bg-primary': b.status === 'Completed', 'bg-danger': b.status === 'Cancelled'}">{{ b.status }}</span>
                        </td>
                        <td>
                            <span class="badge" :class="b.pay_status === 'Paid' ? 'bg-success' : 'bg-warning text-dark'">{{ b.pay_status }}</span>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    `
}
