const movies = require('./movies.repository')
const notification = require('./notification.repository')
const payment = require('./payment.repository')
const cinema = require('./cinema.repository')
const booking = require('./booking.repository')

module.exports = () => {
	  const {database: db} = container.cradle
	  const moviesCollection = db.collection('movies')
	  const disconnect = () => {
	    db.close()
	  }

	  return Object.create({
	    makeBooking,
	    getOrderById,
	    generateTicket,
	    getAllMovies,
	    getMoviePremiers,
	    getMovieById,
	    getCinemasByCity,
	    getCinemaById,
	    getCinemaScheduleByMovie,
	    sendSMS,
	    sendEmail,
	    registerPurchase,
	    getPurchaseById,
	    disconnect
	  })
	
}