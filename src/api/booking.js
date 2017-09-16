'use strict'
const status = require('http-status')

module.exports = ({repo}, app) => {

  //BOOKING
  app.post('/booking', (req, res, next) => {
    const validate = req.container.cradle.validate
    
    Promise.all([
      validate(req.body.user, 'user'),
      validate(req.body.booking, 'booking')
    ])
    .then(([user, booking]) => {
      const payment = {
        userName: user.name + ' ' + user.lastName,
        currency: 'mxn',
        number: user.creditCard.number,
        cvc: user.creditCard.cvc,
        exp_month: user.creditCard.exp_month,
        exp_year: user.creditCard.exp_year,
        amount: booking.totalAmount,
        description: `
          Tickect(s) for movie ${booking.movie},
          with seat(s) ${booking.seats.toString()}
          at time ${booking.schedule}`
      }

      return Promise.all([
        makePuchase(payment, validate),
        Promise.resolve(user),
        Promise.resolve(booking)
      ])
    })
    .then(([paid, user, booking]) => {
      return Promise.all([
        repo.makeBooking(user, booking),
        Promise.resolve(paid),
        Promise.resolve(user)
      ])
    })
    .then(([booking, paid, user]) => {
      return Promise.all([
        repo.generateTicket(paid, booking),
        Promise.resolve(user)
      ])
    })
    .then(([ticket, user]) => {
      const payload = Object.assign({}, ticket, {user: {name: user.name + user.lastName, email: user.email}})
      repo.sendEmail(payload)
      .then(info => {
        res.status(status.OK).json(ticket)
      })
      .catch(next)
    })
    .catch(next)
  })

  app.get('/booking/verify/:orderId', (req, res, next) => {
    repo.getOrderById(req.params.orderId)
      .then(order => {
        res.status(status.OK).json(order)
      })
      .catch(next)
  })

  //MOVIES
  app.get('/movies', (req, res, next) => {
    repo.getAllMovies().then(movies => {
      res.status(status.OK).json(movies)
    }).catch(next)
  })

  app.get('/movies/premieres', (req, res, next) => {
    repo.getMoviePremiers().then(movies => {
      res.status(status.OK).json(movies)
    }).catch(next)
  })

  app.get('/movies/:id', (req, res, next) => {
    repo.getMovieById(req.params.id).then(movie => {
      res.status(status.OK).json(movie)
    }).catch(next)
  })

//CINEMA-CATALOG
app.get('/cinemas', (req, res, next) => {
    repo.getCinemasByCity(req.query.cityId)
      .then(cinemas => {
        res.status(status.OK).json(cinemas)
      })
      .catch(next)
  })

  app.get('/cinemas/:cinemaId', (req, res, next) => {
    repo.getCinemaById(req.params.cinemaId)
      .then(cinema => {
        res.status(status.OK).json(cinema)
      })
      .catch(next)
  })

  app.get('/cinemas/:cityId/:movieId', (req, res, next) => {
    const params = {
      cityId: req.params.cityId,
      movieId: req.params.movieId
    }
    repo.getCinemaScheduleByMovie(params)
      .then(schedules => {
        res.status(status.OK).json(schedules)
      })
      .catch(next)
  })

  //NOTIFICATION SERVICE
  app.post('/notification/sendEmail', (req, res, next) => {

    const validate = req.container.cradle.validate
    validate(req.body.payload, 'notification')
      .then(payload => {
        return repo.sendEmail(payload)
      })
      .then(ok => {
        res.status(status.OK).json({msg: 'ok'})
      })
      .catch(next)
  })

  app.post('/notification/sendSMS', (req, res, next) => {
    const {validate} = req.container.cradle

    validate(req.body.payload, 'notification')
      .then(payload => {
        return repo.sendSMS(payload)
      })
      .then(ok => {
        res.status(status.OK).json({msg: 'ok'})
      })
      .catch(next)
  })

  //PAYMENT SERVICE
  app.post('/payment/makePurchase', (req, res, next) => {
    const {validate} = req.container.cradle

    validate(req.body.paymentOrder, 'payment')
      .then(payment => {
        return repo.registerPurchase(payment)
      })
      .then(paid => {
        res.status(status.OK).json({paid})
      })
      .catch(next)
  })

  function makePuchase(paymentOrder, validate) {
    return new Promise((resolve, reject) => {
      validate(paymentOrder, 'payment')
        .then(payment => {
          return repo.registerPurchase(payment)
        })
        .then(paid => {
          resolve(paid)
        })
        .catch(e => reject(new Error('An error occured with the payment service, err: ' + e)))
    })
  }

  app.get('/payment/getPurchaseById/:id', (req, res, next) => {
    repo.getPurchaseById(req.params.id)
      .then(payment => {
        res.status(status.OK).json({payment})
      })
      .catch(next)
  })


}
