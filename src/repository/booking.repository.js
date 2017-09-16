  const makeBooking = (user, booking) => {
    return new Promise((resolve, reject) => {
      const payload = {
        city: booking.city,
        userType: (user.membership) ? 'loyal' : 'normal',
        totalAmount: booking.totalAmount,
        cinema: {
          name: booking.cinema,
          room: booking.cinemaRoom,
          seats: booking.seats.toString()
        },
        movie: {
          title: booking.movie.title,
          format: booking.movie.format,
          schedule: booking.schedule
        }
      }

      db.collection('booking').insertOne(payload, (err, booked) => {
        if (err) {
          reject(new Error('An error occuered registring a user booking, err:' + err))
        }
        resolve(payload)
      })
    })
  }

  const generateTicket = (paid, booking) => {
    return new Promise((resolve, reject) => {
      const payload = Object.assign({}, booking, {orderId: paid.charge.id, description: paid.description})
      db.collection('tickets').insertOne(payload, (err, ticket) => {
        if (err) {
          reject(new Error('an error occured registring a ticket, err:' + err))
        }
        resolve(payload)
      })
    })
  }

  const getOrderById = (orderId) => {
    return new Promise((resolve, reject) => {
      const ObjectID = container.resolve('ObjectID')
      const query = {_id: new ObjectID(orderId)}
      const response = (err, order) => {
        if (err) {
          reject(new Error('An error occuered retrieving a order, err: ' + err))
        }
        resolve(order)
      }
      db.collection('booking').findOne(query, {}, response)
    })
  }
module.exports = Object.assign({}, {getOrderById, generateTicket, makeBooking})